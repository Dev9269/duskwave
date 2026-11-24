import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Pill, Text, colors, fontFamily, radii, spacing } from '@/ui';

import {
  BROWSE_CATEGORIES,
  SEARCH_BPM_RANGES,
  SEARCH_GENRES,
  SEARCH_MOODS,
  SEARCH_SOURCES,
  selectBpmRange,
  toggleChipValue,
  type BrowseCategory,
  type SearchFilterState,
  type SearchSource,
} from './search-ui';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SearchField({
  value,
  onChangeText,
  onClear,
  placeholder = 'What do you want to play?',
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <Ionicons name="search" size={20} color={focused ? colors.text : colors.textMuted} />
      <TextInput
        accessibilityLabel="Search"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        style={styles.input}
        value={value}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={onClear}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function BrowseAll({ onSelect }: { onSelect: (category: BrowseCategory) => void }) {
  return (
    <View style={styles.browseSection}>
      <Text variant="heading" style={styles.browseTitle}>
        Browse all
      </Text>
      <View style={styles.browseGrid}>
        {BROWSE_CATEGORIES.map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${category.label}`}
            onPress={() => onSelect(category)}
            style={({ pressed }) => [
              styles.browseTile,
              { backgroundColor: category.color },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.browseLabel} numberOfLines={2}>
              {category.label}
            </Text>
            <Ionicons
              name={category.icon}
              size={44}
              color="rgba(0, 0, 0, 0.35)"
              style={styles.browseIcon}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function SourceFilterChips({
  source,
  onChange,
}: {
  source: SearchSource;
  onChange: (source: SearchSource) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {SEARCH_SOURCES.map((item) => (
        <Pill
          key={item.id}
          label={item.label}
          selected={source === item.id}
          onPress={() => onChange(item.id)}
        />
      ))}
    </ScrollView>
  );
}

export function SearchFilterChips({
  filters,
  onChange,
}: {
  filters: SearchFilterState;
  onChange: (filters: SearchFilterState) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {SEARCH_GENRES.map((genre) => (
        <Pill
          key={genre}
          label={capitalize(genre)}
          selected={filters.genre === genre}
          onPress={() => onChange({ ...filters, genre: toggleChipValue(filters.genre, genre) })}
        />
      ))}
      {SEARCH_MOODS.map((mood) => (
        <Pill
          key={mood}
          label={capitalize(mood)}
          selected={filters.mood === mood}
          onPress={() => onChange({ ...filters, mood: toggleChipValue(filters.mood, mood) })}
        />
      ))}
      {SEARCH_BPM_RANGES.filter((range) => range.id !== 'any').map((range) => (
        <Pill
          key={range.id}
          label={range.label}
          selected={filters.bpmRangeId === range.id}
          onPress={() => onChange({ ...filters, bpmRangeId: selectBpmRange(filters.bpmRangeId, range.id) })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.transparent,
    backgroundColor: colors.elevated,
  },
  fieldFocused: { borderColor: colors.text },
  input: {
    flex: 1,
    height: 48,
    paddingVertical: 0,
    color: colors.text,
    fontFamily: fontFamily.body,
    fontSize: 16,
  },
  browseSection: { marginTop: spacing.xl },
  browseTitle: { marginBottom: spacing.md },
  browseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  browseTile: {
    width: '48.5%',
    height: 92,
    borderRadius: radii.md,
    padding: spacing.md,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  browseLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
    maxWidth: '72%',
  },
  browseIcon: { position: 'absolute', right: -6, bottom: -2, transform: [{ rotate: '22deg' }] },
  pressed: { opacity: 0.85 },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
});
