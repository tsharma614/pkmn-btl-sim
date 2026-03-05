import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MoveGrid } from './MoveGrid';
import { SwitchList } from './SwitchList';
import { colors, spacing } from '../theme';
import { useBattle } from '../state/battle-context';
import type { PokemonType } from '../../types';

interface Props {
  disabled: boolean;
}

export function ActionPanel({ disabled }: Props) {
  const { state, dispatch, selectMove, selectSwitch } = useBattle();
  const { yourState, actionView } = state;

  if (!yourState) return null;

  const active = yourState.team[yourState.activePokemonIndex];
  const opponentTypes = (state.opponentVisible?.activePokemon?.species.types ?? []) as PokemonType[];

  // Check if must switch (all moves unusable)
  const usableMoves = active.moves.filter(
    m => m.currentPp > 0 && !m.disabled &&
      !(active.choiceLocked && m.name !== active.choiceLocked),
  );
  const aliveSwitches = yourState.team.filter(
    (p, i) => i !== yourState.activePokemonIndex && p.isAlive,
  );
  const mustSwitch = usableMoves.length === 0 && aliveSwitches.length > 0;

  // Auto-struggle if no moves and no switches
  const canStruggle = usableMoves.length === 0 && aliveSwitches.length === 0;

  return (
    <View style={styles.container}>
      {/* Tab buttons */}
      {!mustSwitch && !canStruggle && (
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, actionView === 'moves' && styles.tabActive]}
            onPress={() => dispatch({ type: 'SET_ACTION_VIEW', view: 'moves' })}
          >
            <Text style={[styles.tabText, actionView === 'moves' && styles.tabTextActive]}>
              Fight
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, actionView === 'switch' && styles.tabActive]}
            onPress={() => dispatch({ type: 'SET_ACTION_VIEW', view: 'switch' })}
          >
            <Text style={[styles.tabText, actionView === 'switch' && styles.tabTextActive]}>
              Pokemon
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {canStruggle ? (
        <View style={styles.struggleContainer}>
          <Text style={styles.struggleText}>No moves left! Using Struggle...</Text>
          <TouchableOpacity
            style={styles.struggleBtn}
            onPress={() => selectMove(0)}
            disabled={disabled}
          >
            <Text style={styles.struggleBtnText}>Struggle</Text>
          </TouchableOpacity>
        </View>
      ) : mustSwitch ? (
        <View>
          <Text style={styles.mustSwitchText}>No moves left! You must switch.</Text>
          <SwitchList
            team={yourState.team}
            activePokemonIndex={yourState.activePokemonIndex}
            onSelectSwitch={selectSwitch}
            disabled={disabled}
          />
        </View>
      ) : actionView === 'moves' ? (
        <MoveGrid
          active={active}
          onSelectMove={selectMove}
          disabled={disabled}
          opponentTypes={opponentTypes}
        />
      ) : (
        <SwitchList
          team={yourState.team}
          activePokemonIndex={yourState.activePokemonIndex}
          onSelectSwitch={selectSwitch}
          disabled={disabled}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },
  struggleContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  struggleText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  struggleBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  struggleBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  mustSwitchText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
