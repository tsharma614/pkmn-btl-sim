import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const STATUS_COLORS: Record<string, string> = {
  burn: '#EE8130',
  brn: '#EE8130',
  paralysis: '#F7D02C',
  par: '#F7D02C',
  sleep: '#A0A0B0',
  slp: '#A0A0B0',
  poison: '#A33EA1',
  psn: '#A33EA1',
  toxic: '#6F35FC',
  tox: '#6F35FC',
  freeze: '#96D9D6',
  frz: '#96D9D6',
};

const STATUS_LABELS: Record<string, string> = {
  burn: 'BRN', brn: 'BRN',
  paralysis: 'PAR', par: 'PAR',
  sleep: 'SLP', slp: 'SLP',
  poison: 'PSN', psn: 'PSN',
  toxic: 'TOX', tox: 'TOX',
  freeze: 'FRZ', frz: 'FRZ',
};

interface Props {
  status: string | null;
}

export function StatusBadge({ status }: Props) {
  if (!status) return null;
  const bg = STATUS_COLORS[status] || '#888';
  const label = STATUS_LABELS[status] || status.toUpperCase().slice(0, 3);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  text: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
