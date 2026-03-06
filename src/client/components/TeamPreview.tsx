import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';
import { colors, spacing } from '../theme';
import type { OwnPokemon } from '../../server/types';

interface Props {
  team: OwnPokemon[];
  onSelectLead: (index: number) => void;
  onExitToMenu?: () => void;
}

export function TeamPreview({ team, onSelectLead, onExitToMenu }: Props) {
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const p = team[selected];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Lead</Text>

      {/* Selected Pokemon detail */}
      <View style={styles.detail}>
        <PokemonSprite
          speciesId={p.species.id}
          facing="front"
          size={100}
        />
        <Text style={styles.detailName}>{p.species.name}</Text>
        <View style={styles.typesRow}>
          {p.species.types.map(t => (
            <TypeBadge key={t} type={t} />
          ))}
        </View>

        {/* Ability + Item row */}
        <View style={styles.abilityItemRow}>
          <Text style={styles.abilityText}>{p.ability}</Text>
          {p.item && (
            <View style={styles.itemPill}>
              <Text style={styles.itemText}>@ {p.item}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          {Object.entries(p.stats).map(([stat, val]) => (
            <View key={stat} style={styles.statItem}>
              <Text style={styles.statLabel}>{stat.toUpperCase()}</Text>
              <Text style={styles.statValue}>{val as number}</Text>
            </View>
          ))}
        </View>
        <View style={styles.movesCol}>
          {p.moves.map((m, i) => (
            <Text key={i} style={styles.moveText}>
              {m.name}
            </Text>
          ))}
        </View>
      </View>

      {/* Team grid */}
      <ScrollView horizontal contentContainerStyle={styles.teamRow} pointerEvents={submitted ? 'none' : 'auto'}>
        {team.map((mon, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.teamSlot, i === selected && styles.teamSlotSelected, submitted && { opacity: 0.5 }]}
            onPress={() => setSelected(i)}
            activeOpacity={0.7}
          >
            <PokemonSprite speciesId={mon.species.id} facing="front" size={50} />
            <Text style={styles.teamName} numberOfLines={1}>
              {mon.species.name}
            </Text>
            {mon.item && (
              <Text style={styles.teamItem} numberOfLines={1}>
                {mon.item}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Confirm button / waiting state */}
      {submitted ? (
        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.waitingText}>Waiting for opponent...</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => {
              setSubmitted(true);
              onSelectLead(selected);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmText}>
              Go, {p.species.name}!
            </Text>
          </TouchableOpacity>

          {onExitToMenu && (
            <TouchableOpacity
              style={styles.exitBtn}
              onPress={onExitToMenu}
              activeOpacity={0.7}
            >
              <Text style={styles.exitText}>Exit to Menu</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  detail: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  typesRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  abilityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 8,
  },
  abilityText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  itemPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  itemText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statItem: {
    alignItems: 'center',
    width: 44,
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  movesCol: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  moveText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  teamRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  teamSlot: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.sm,
    width: 76,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  teamSlotSelected: {
    borderColor: colors.accent,
  },
  teamName: {
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  teamItem: {
    color: colors.textDim,
    fontSize: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  confirmText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  exitBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  exitText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    marginTop: spacing.lg,
  },
  waitingText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    fontStyle: 'italic',
  },
});
