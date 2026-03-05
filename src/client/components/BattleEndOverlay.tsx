import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Share } from 'react-native';
import { saveBattleResult } from '../utils/battle-history';
import { colors, spacing } from '../theme';
import { HpBar } from './HpBar';
import { PokemonSprite } from './PokemonSprite';
import type { BattleEndPayload, OwnPokemon } from '../../server/types';
import type { BattleStats } from '../state/battle-reducer';
import type { GameMode } from '../state/battle-reducer';

interface Props {
  data: BattleEndPayload;
  playerName: string;
  opponentName: string;
  stats: BattleStats;
  battleLog: string[];
  gameMode: GameMode;
  onPlayAgain: () => void;
  onExitToMenu: () => void;
}

function formatReason(reason: string): string {
  switch (reason) {
    case 'all_fainted': return 'All Pokemon fainted';
    case 'forfeit': return 'Forfeit';
    case 'disconnect': return 'Disconnected';
    default: return reason;
  }
}

function getMVP(stats: BattleStats, team: OwnPokemon[]): { name: string; speciesId: string; label: string; dmg: number; kos: number } | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const [name, dmg] of Object.entries(stats.pokemonDamage)) {
    const kos = stats.pokemonKOs[name] || 0;
    const score = dmg + kos * 200;
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  if (!best) return null;
  const kos = stats.pokemonKOs[best] || 0;
  const dmg = stats.pokemonDamage[best] || 0;
  const parts: string[] = [];
  if (dmg > 0) parts.push(`${dmg} dmg`);
  if (kos > 0) parts.push(`${kos} KO${kos > 1 ? 's' : ''}`);
  const pokemon = team.find(p => p.species.name === best);
  const speciesId = pokemon?.species.id || best.toLowerCase().replace(/[^a-z0-9]/g, '');
  return { name: best, speciesId, label: parts.join(', '), dmg, kos };
}

function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm || singular + 's');
}

function getAce(stats: BattleStats): { name: string; kos: number } | null {
  let best: string | null = null;
  let bestKOs = 0;
  for (const [name, kos] of Object.entries(stats.pokemonKOs)) {
    if (kos >= 3 && kos > bestKOs) {
      bestKOs = kos;
      best = name;
    }
  }
  return best ? { name: best, kos: bestKOs } : null;
}

function getAwards(
  isWinner: boolean,
  stats: BattleStats,
  yourTeam: OwnPokemon[],
): string[] {
  const awards: string[] = [];
  if (isWinner && stats.opponentKOs === 0 && yourTeam.every(p => p.isAlive)) {
    awards.push('\uD83E\uDDF9 Clean Sweep');
  }
  if (isWinner) {
    const alive = yourTeam.filter(p => p.isAlive).length;
    if (alive === 1) awards.push('\uD83D\uDE30 Clutch Victory');
  }
  if (stats.playerMovesUsed > 0 && stats.playerMisses === 0) {
    awards.push('\uD83C\uDFAF Perfect Aim');
  }
  if (stats.playerCrits >= 3) {
    awards.push('\u2694\uFE0F Crit Lord');
  }
  if (stats.playerKOs >= 4) {
    awards.push('\uD83D\uDC80 Massacre');
  }
  const ace = getAce(stats);
  if (ace) {
    awards.push(`\uD83D\uDC51 Ace: ${ace.name}`);
  }
  return awards.slice(0, 3);
}

// --- Shareable battle flex ---

const WIN_DOMINATION = [
  (p: string, o: string) => `${p} absolutely fucking annihilated ${o}!`,
  (p: string, o: string) => `${p} raw-dogged ${o}'s entire team!`,
  (p: string, o: string) => `${p} just committed a goddamn war crime against ${o}!`,
  (p: string, o: string) => `${p} made ${o} their personal bitch!`,
  (p: string, o: string) => `${o} got absolutely skull-fucked by ${p}!`,
];

const WIN_CLOSE = [
  (p: string, o: string, t: number) => `${p} squeezed ${o}'s balls and came out on top!`,
  (p: string, o: string, t: number) => `${p} just barely fucked ${o} sideways!`,
  (p: string, o: string, t: number) => `${p} edged ${o} for ${t} turns then finished them off!`,
  (p: string, o: string, t: number) => `${p} beat ${o} by the skin of their dick!`,
];

const LOSS_PHRASES = [
  (p: string, o: string, t: number) => `${p} got absolutely railed by ${o}. Not even close.`,
  (p: string, o: string, t: number) => `${p} bent over and took it from ${o} for ${t} turns.`,
  (p: string, o: string, t: number) => `${o} destroyed ${p}'s hole. Unrecoverable.`,
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildShareMessage(
  playerName: string,
  opponentName: string,
  isWinner: boolean,
  stats: BattleStats,
  turn: number,
  mvp: ReturnType<typeof getMVP>,
  yourTeam: OwnPokemon[],
): string {
  let headline: string;

  if (isWinner) {
    const remaining = 6 - stats.opponentKOs;
    if (remaining >= 4) {
      headline = pickRandom(WIN_DOMINATION)(playerName, opponentName);
    } else {
      headline = pickRandom(WIN_CLOSE)(playerName, opponentName, turn);
    }
  } else {
    headline = pickRandom(LOSS_PHRASES)(playerName, opponentName, turn);
  }

  const accuracy = stats.playerMovesUsed > 0
    ? Math.round(((stats.playerMovesUsed - stats.playerMisses) / stats.playerMovesUsed) * 100)
    : 100;

  const lines = [headline, ''];

  lines.push(`\u2694\uFE0F ${stats.playerDamageDealt} damage dealt | \uD83D\uDC80 ${stats.playerKOs} KOs`);
  lines.push(`\uD83C\uDFAF ${accuracy}% accuracy (${stats.playerMovesUsed} moves)`);
  if (mvp) {
    lines.push(`\uD83C\uDFC6 MVP: ${mvp.name} (${mvp.label})`);
  }
  if (stats.biggestHitDealt) {
    lines.push(`\uD83D\uDCA5 Biggest hit: ${stats.biggestHitDealt.pokemon}'s ${stats.biggestHitDealt.move} for ${stats.biggestHitDealt.damage}`);
  }
  if (stats.superEffectives > 0) {
    lines.push(`\u26A1 ${stats.superEffectives} super effective hit${stats.superEffectives > 1 ? 's' : ''}`);
  }
  if (stats.statusesInflicted > 0) {
    lines.push(`\uD83E\uDDEA ${stats.statusesInflicted} ${plural(stats.statusesInflicted, 'status', 'statuses')} inflicted`);
  }
  if (stats.playerMisses > 0) {
    lines.push(`\uD83D\uDE35 ${stats.playerMisses} missed ${plural(stats.playerMisses, 'attack')}`);
  }
  const awards = getAwards(isWinner, stats, yourTeam);
  if (awards.length > 0) {
    lines.push(awards.join(' | '));
  }
  lines.push(`\uD83C\uDFAE PBS - Pokemon Battle Simulator`);

  return lines.join('\n');
}

function buildBattleLogText(
  playerName: string,
  opponentName: string,
  isWinner: boolean,
  stats: BattleStats,
  battleLog: string[],
  data: BattleEndPayload,
): string {
  const sections: string[] = [];

  // Header
  sections.push(battleLog.filter(l => !l.startsWith('---') && !l.startsWith('  ')).length > 0
    ? battleLog.slice(0, battleLog.indexOf('')).join('\n')
    : `=== PBS Battle Log ===\nPlayer: ${playerName}\nOpponent: ${opponentName}`
  );

  // Opponent team (revealed at end)
  if (data.finalState.opponentTeam.length > 0) {
    sections.push(`Opponent Team:\n${data.finalState.opponentTeam.map((p, i) =>
      `  ${i + 1}. ${p.species.name} (${p.species.types.join('/')}${p.item ? ', ' + p.item : ''}, ${p.ability})`
    ).join('\n')}`);
  }

  // Result
  sections.push(`Result: ${isWinner ? 'WIN' : 'LOSS'} in ${data.finalState.turn} turns (${data.reason})`);

  // Stats summary
  const accuracy = stats.playerMovesUsed > 0
    ? Math.round(((stats.playerMovesUsed - stats.playerMisses) / stats.playerMovesUsed) * 100)
    : 100;
  sections.push([
    `Stats:`,
    `  Damage Dealt: ${stats.playerDamageDealt} | Damage Taken: ${stats.opponentDamageDealt}`,
    `  KOs Scored: ${stats.playerKOs} | Pokemon Lost: ${stats.opponentKOs}`,
    `  Moves Used: ${stats.playerMovesUsed} | Switches: ${stats.playerSwitches}`,
    `  Accuracy: ${accuracy}% | Crits: ${stats.playerCrits}`,
    `  Super Effective Hits: ${stats.superEffectives}`,
    stats.biggestHitDealt ? `  Biggest Hit Dealt: ${stats.biggestHitDealt.pokemon}'s ${stats.biggestHitDealt.move} for ${stats.biggestHitDealt.damage}` : '',
    stats.biggestHitTaken ? `  Biggest Hit Taken: ${stats.biggestHitTaken.pokemon}'s ${stats.biggestHitTaken.move} for ${stats.biggestHitTaken.damage}` : '',
  ].filter(Boolean).join('\n'));

  // Final standings
  sections.push(`Final Standings:\n  Your Team:\n${data.finalState.yourTeam.map(p =>
    `    ${p.species.name}: ${p.isAlive ? `${p.currentHp}/${p.maxHp} HP (${Math.round(p.currentHp / p.maxHp * 100)}%)` : 'FAINTED'}`
  ).join('\n')}\n  Opponent Team:\n${data.finalState.opponentTeam.map(p =>
    `    ${p.species.name}: ${p.isAlive ? `${p.currentHp}/${p.maxHp} HP (${Math.round(p.currentHp / p.maxHp * 100)}%)` : 'FAINTED'}`
  ).join('\n')}`);

  // Full battle log
  const turnLines = battleLog.filter(l => l.startsWith('---') || l.startsWith('  ') || l.includes(' used ') || l.includes(' was sent out'));
  if (turnLines.length > 0) {
    sections.push(`Turn-by-Turn Log:\n${turnLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

export function BattleEndOverlay({ data, playerName, opponentName, stats, battleLog, gameMode, onPlayAgain, onExitToMenu }: Props) {
  const isWinner = data.winner === playerName;
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    const pokemonLeft = data.finalState.yourTeam.filter(p => p.isAlive).length;
    saveBattleResult({
      date: new Date().toISOString(),
      opponent: opponentName,
      result: isWinner ? 'win' : 'loss',
      pokemonLeft,
    });
  }, []);
  const hasTeamData = data.finalState.yourTeam.length > 0;
  const mvp = getMVP(stats, data.finalState.yourTeam);
  const awards = getAwards(isWinner, stats, data.finalState.yourTeam);
  const accuracy = stats.playerMovesUsed > 0
    ? Math.round(((stats.playerMovesUsed - stats.playerMisses) / stats.playerMovesUsed) * 100)
    : 100;

  const handleShare = () => {
    const message = buildShareMessage(
      playerName,
      opponentName,
      isWinner,
      stats,
      data.finalState.turn,
      mvp,
      data.finalState.yourTeam,
    );
    Share.share({ message });
  };

  const handleShareLog = () => {
    const logText = buildBattleLogText(playerName, opponentName, isWinner, stats, battleLog, data);
    Share.share({ message: logText });
  };

  // Build badge list (conditional, only show if > 0)
  const badges: { emoji: string; text: string }[] = [];
  if (stats.playerCrits > 0) badges.push({ emoji: '\uD83C\uDFAF', text: `${stats.playerCrits} ${plural(stats.playerCrits, 'Crit')}` });
  if (stats.superEffectives > 0) badges.push({ emoji: '\u26A1', text: `${stats.superEffectives} Super Effective` });
  if (stats.statusesInflicted > 0) badges.push({ emoji: '\uD83E\uDDEA', text: `${stats.statusesInflicted} ${plural(stats.statusesInflicted, 'Status', 'Statuses')} Inflicted` });
  if (stats.playerMisses > 0) badges.push({ emoji: '\uD83D\uDE35', text: `${stats.playerMisses} ${plural(stats.playerMisses, 'Miss', 'Misses')}` });
  if (stats.opponentCrits > 0) badges.push({ emoji: '\uD83D\uDC94', text: `${stats.opponentCrits} ${plural(stats.opponentCrits, 'Crit')} Taken` });
  if (stats.protectsUsed > 0) badges.push({ emoji: '\uD83D\uDEE1\uFE0F', text: `${stats.protectsUsed} ${plural(stats.protectsUsed, 'Protect')}` });
  if (stats.playerTotalHealing > 0) badges.push({ emoji: '\uD83D\uDC9A', text: `${stats.playerTotalHealing} HP Healed` });

  return (
    <View style={styles.overlay}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={styles.modal}>
          {/* Result header */}
          <Text style={[styles.result, isWinner ? styles.win : styles.lose]}>
            {isWinner ? 'YOU WIN!' : 'YOU LOSE!'}
          </Text>
          <Text style={styles.detail}>
            {formatReason(data.reason)}{data.finalState.turn > 0 ? ` \u2014 Turn ${data.finalState.turn}` : ''}
          </Text>

          {/* Battle Stats */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>BATTLE STATS</Text>

            <View style={styles.statsGrid}>
              <StatBox label="Damage Dealt" value={stats.playerDamageDealt} color={colors.hpGreen} />
              <StatBox label="Damage Taken" value={stats.opponentDamageDealt} color={colors.hpRed} />
              <StatBox label="KOs Scored" value={stats.playerKOs} color={colors.hpGreen} />
              <StatBox label="Pokemon Lost" value={stats.opponentKOs} color={colors.hpRed} />
            </View>

            {/* Biggest hits */}
            {stats.biggestHitDealt && (
              <View style={styles.bigHitRow}>
                <Text style={styles.bigHitLabel}>Biggest Hit Dealt</Text>
                <Text style={styles.bigHitValue}>
                  {`${stats.biggestHitDealt.pokemon}'s ${stats.biggestHitDealt.move} \u2014 ${stats.biggestHitDealt.damage} dmg`}
                </Text>
              </View>
            )}
            {stats.biggestHitTaken && (
              <View style={styles.bigHitRow}>
                <Text style={styles.bigHitLabel}>Biggest Hit Taken</Text>
                <Text style={styles.bigHitValue}>
                  {`${stats.biggestHitTaken.pokemon}'s ${stats.biggestHitTaken.move} \u2014 ${stats.biggestHitTaken.damage} dmg`}
                </Text>
              </View>
            )}

            {/* MVP */}
            {mvp && (
              <View style={styles.mvpRow}>
                <Text style={styles.mvpLabel}>MVP</Text>
                <View style={styles.mvpSpriteWrap}>
                  <PokemonSprite speciesId={mvp.speciesId} facing="front" size={72} />
                </View>
                <Text style={styles.mvpName}>{mvp.name}</Text>
                <Text style={styles.mvpDetail}>{mvp.label}</Text>
              </View>
            )}
          </View>

          {/* Highlights */}
          <View style={styles.statsSection}>
            <Text style={styles.statsTitle}>HIGHLIGHTS</Text>

            <View style={styles.statsGrid}>
              <StatBox label="Moves Used" value={stats.playerMovesUsed} color={colors.textSecondary} />
              <StatBox label="Switches" value={stats.playerSwitches} color={colors.textSecondary} />
              <StatBox label="Accuracy" value={accuracy} color={colors.textSecondary} suffix="%" />
              <StatBox label="Turns" value={stats.turnsPlayed} color={colors.textSecondary} />
            </View>

            {/* Badges */}
            {badges.length > 0 && (
              <View style={styles.badgeRow}>
                {badges.map((b, i) => (
                  <View key={i} style={styles.badge}>
                    <Text style={styles.badgeText}>{`${b.emoji} ${b.text}`}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Awards */}
            {awards.length > 0 && (
              <View style={styles.awardsSection}>
                {awards.map((award, i) => (
                  <Text key={i} style={styles.awardText}>{award}</Text>
                ))}
              </View>
            )}
          </View>

          {/* Team summaries */}
          {hasTeamData && (
            <View style={styles.teams}>
              <View style={styles.teamCol}>
                <Text style={styles.teamLabel}>Your Team</Text>
                {data.finalState.yourTeam.map((p, i) => (
                  <View key={i} style={styles.pokemonRow}>
                    <Text style={[styles.pokemonName, !p.isAlive && styles.fainted]} numberOfLines={1}>
                      {p.species.name}
                    </Text>
                    {p.isAlive ? (
                      <View style={styles.pokemonHp}>
                        <HpBar currentHp={p.currentHp} maxHp={p.maxHp} width={50} height={4} />
                        <Text style={styles.pokemonHpText}>{Math.round((p.currentHp / p.maxHp) * 100)}%</Text>
                      </View>
                    ) : (
                      <Text style={styles.fntText}>FNT</Text>
                    )}
                  </View>
                ))}
              </View>
              <View style={styles.teamCol}>
                <Text style={styles.teamLabel}>Opponent</Text>
                {data.finalState.opponentTeam.map((p, i) => (
                  <View key={i} style={styles.pokemonRow}>
                    <Text style={[styles.pokemonName, !p.isAlive && styles.fainted]} numberOfLines={1}>
                      {p.species.name}
                    </Text>
                    {p.isAlive ? (
                      <View style={styles.pokemonHp}>
                        <HpBar currentHp={p.currentHp} maxHp={p.maxHp} width={50} height={4} />
                        <Text style={styles.pokemonHpText}>{Math.round((p.currentHp / p.maxHp) * 100)}%</Text>
                      </View>
                    ) : (
                      <Text style={styles.fntText}>FNT</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Share buttons */}
          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShareLog} activeOpacity={0.7}>
              <Text style={styles.shareBtnText}>Share Battle Log</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btn} onPress={onPlayAgain} activeOpacity={0.7}>
            <Text style={styles.btnText}>
              {gameMode === 'online' ? 'Rematch' : 'Play Again'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exitBtn} onPress={onExitToMenu} activeOpacity={0.7}>
            <Text style={styles.exitBtnText}>Exit to Menu</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, color, suffix }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statBoxValue, { color }]}>{value}{suffix || ''}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xl,
    width: '100%',
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  result: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
    letterSpacing: 1,
  },
  win: { color: colors.hpGreen },
  lose: { color: colors.hpRed },
  detail: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: spacing.lg,
  },

  // Stats section
  statsSection: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsTitle: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statBoxValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  statBoxLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  bigHitRow: {
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  bigHitLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  bigHitValue: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  mvpRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  mvpLabel: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  mvpSpriteWrap: {
    width: 72,
    height: 72,
    marginVertical: 4,
  },
  mvpName: {
    color: '#ffd700',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  mvpDetail: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },

  // Badges
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },

  // Awards
  awardsSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  awardText: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },

  // Teams
  teams: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  teamCol: {
    flex: 1,
  },
  teamLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  pokemonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pokemonName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  fainted: {
    color: colors.textDim,
  },
  pokemonHp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pokemonHpText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  fntText: {
    color: colors.hpRed,
    fontSize: 9,
    fontWeight: '800',
  },

  // Share buttons
  shareRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.sm,
  },
  shareBtn: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },

  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  exitBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: 40,
    paddingVertical: 10,
  },
  exitBtnText: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '600',
  },
});
