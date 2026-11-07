import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApiService from '../services/api';
import { colors, typography, spacing, radius, shadows } from '../theme/colors';

/**
 * CalendarScreen (Academic Calendar & Schedule)
 * Calendar View Screen
 * Features:
 * - Real calendar data from backend GET /api/calendar/calendar
 * - Interactive month grid with day cells
 * - Colored dots for holidays, exams, events, and teacher leaves
 * - Day event details below the calendar
 */
export default function CalendarScreen({ onClose }) {
  const insets = useSafeAreaInsets();

  // BUG-11 fix: dynamically detect current year or fallback to academic seed anchor (Nov 2026)
  const defaultAcademicDate = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() === 2026) {
      return now;
    }
    return new Date(2026, 10, 4);
  }, []);

  const [currentDate, setCurrentDate] = useState(defaultAcademicDate);
  const [selectedDateStr, setSelectedDateStr] = useState(
    `${defaultAcademicDate.getFullYear()}-${String(defaultAcademicDate.getMonth() + 1).padStart(2, '0')}-${String(defaultAcademicDate.getDate()).padStart(2, '0')}`
  );
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12

  useEffect(() => {
    loadCalendar();
  }, [year, month]);

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const res = await ApiService.getAcademicCalendar(year, month);
      if (res.success && res.data) {
        setCalendarData(res.data);
      }
    } catch (err) {
      console.error('Error fetching academic calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 2, 1);
    setCurrentDate(prev);
    setSelectedDateStr(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const handleNextMonth = () => {
    const next = new Date(year, month, 1);
    setCurrentDate(next);
    setSelectedDateStr(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Compute calendar grid days
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
    // Adjust so Monday is 0, Sunday is 6
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells = [];
    // Padding before 1st of month
    for (let i = 0; i < adjustedFirstDay; i++) {
      cells.push({ day: null, dateStr: null });
    }
    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr: dStr });
    }
    return cells;
  }, [year, month]);

  const eventsForSelectedDate = calendarData?.eventsByDate?.[selectedDateStr] || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.navy} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Academic Calendar</Text>
          <Text style={styles.headerSubtitle}>Exams, Holidays & Events</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Selector Card */}
        <View style={styles.monthCard}>
          <TouchableOpacity style={styles.monthNavBtn} onPress={handlePrevMonth} activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color={colors.navy} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <TouchableOpacity style={styles.monthNavBtn} onPress={handleNextMonth} activeOpacity={0.7}>
            <Feather name="chevron-right" size={20} color={colors.navy} />
          </TouchableOpacity>
        </View>

        {/* Calendar Card */}
        <View style={styles.calendarCard}>
          {/* Weekday Labels (Mon - Sun) */}
          <View style={styles.weekdayRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
              <Text
                key={day}
                style={[
                  styles.weekdayText,
                  idx === 6 && { color: colors.red }, // Sunday in red
                ]}
              >
                {day}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          {loading ? (
            <View style={styles.calendarLoading}>
              <ActivityIndicator size="small" color={colors.blue} />
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {calendarGrid.map((cell, idx) => {
                if (!cell.day) {
                  return <View key={`empty-${idx}`} style={styles.cellEmpty} />;
                }

                const isSelected = cell.dateStr === selectedDateStr;
                const events = calendarData?.eventsByDate?.[cell.dateStr] || [];
                const isSunday = (idx % 7) === 6;

                return (
                  <TouchableOpacity
                    key={cell.dateStr}
                    style={[
                      styles.cell,
                      isSelected && styles.cellSelected,
                    ]}
                    onPress={() => setSelectedDateStr(cell.dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isSunday && { color: colors.red },
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>

                    {/* Event Dots */}
                    <View style={styles.dotsRow}>
                      {events.slice(0, 3).map((ev, eIdx) => (
                        <View
                          key={eIdx}
                          style={[
                            styles.eventDot,
                            { backgroundColor: isSelected ? '#fff' : ev.color || colors.blue },
                          ]}
                        />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Color Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.red }]} />
              <Text style={styles.legendLabel}>Holiday/Off</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.amber }]} />
              <Text style={styles.legendLabel}>Exam</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.blue }]} />
              <Text style={styles.legendLabel}>Event</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.green }]} />
              <Text style={styles.legendLabel}>My Leave</Text>
            </View>
          </View>
        </View>

        {/* Selected Date Events */}
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>
            Events on {new Date(selectedDateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={styles.eventsCount}>{eventsForSelectedDate.length} items</Text>
        </View>

        {eventsForSelectedDate.length === 0 ? (
          <View style={styles.emptyEventsCard}>
            <Feather name="calendar" size={28} color={colors.mut} />
            <Text style={styles.emptyEventsText}>No scheduled events or holidays on this date.</Text>
          </View>
        ) : (
          eventsForSelectedDate.map((ev, idx) => (
            <View key={ev._id || idx} style={[styles.eventDetailCard, { borderLeftColor: ev.color || colors.blue }]}>
              <View style={styles.eventDetailTop}>
                <Text style={styles.eventDetailTitle}>{ev.title}</Text>
                <View style={[styles.eventTypePill, { backgroundColor: ev.color + '20' }]}>
                  <Text style={[styles.eventTypePillText, { color: ev.color }]}>
                    {ev.type?.toUpperCase()}
                  </Text>
                </View>
              </View>

              {ev.description ? (
                <Text style={styles.eventDetailDesc}>{ev.description}</Text>
              ) : null}

              {(ev.startTime || ev.location) ? (
                <View style={styles.eventDetailMeta}>
                  {ev.startTime && (
                    <View style={styles.metaRow}>
                      <Feather name="clock" size={12} color={colors.mut} />
                      <Text style={styles.metaText}>{ev.startTime} - {ev.endTime || 'End'}</Text>
                    </View>
                  )}
                  {ev.location && (
                    <View style={styles.metaRow}>
                      <Feather name="map-pin" size={12} color={colors.mut} />
                      <Text style={styles.metaText}>{ev.location}</Text>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.bold,
    color: colors.navy,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    ...shadows.card,
  },
  monthNavBtn: {
    padding: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: typography.bold,
    color: colors.navy,
  },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
    ...shadows.card,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 10,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontFamily: typography.bold,
    color: colors.mut,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  cellEmpty: {
    width: '14.28%',
    height: 48,
  },
  cellSelected: {
    backgroundColor: colors.navy,
  },
  dayNumber: {
    fontSize: 13,
    fontFamily: typography.semiBold,
    color: colors.navy,
  },
  dayNumberSelected: {
    color: '#fff',
    fontFamily: typography.bold,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
    height: 5,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  calendarLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: typography.medium,
    color: colors.mut,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eventsTitle: {
    fontSize: 15,
    fontFamily: typography.bold,
    color: colors.navy,
  },
  eventsCount: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
  },
  emptyEventsCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyEventsText: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
    marginTop: 8,
    textAlign: 'center',
  },
  eventDetailCard: {
    backgroundColor: '#fff',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  eventDetailTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  eventDetailTitle: {
    fontSize: 14,
    fontFamily: typography.bold,
    color: colors.navy,
    flex: 1,
    paddingRight: 8,
  },
  eventTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventTypePillText: {
    fontSize: 10,
    fontFamily: typography.bold,
  },
  eventDetailDesc: {
    fontSize: 12,
    fontFamily: typography.medium,
    color: colors.mut,
    marginBottom: 8,
    lineHeight: 18,
  },
  eventDetailMeta: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: typography.medium,
    color: colors.mut,
  },
});

