/**
 * DESIGN SYSTEM - THEME TOKENS
 * Spark Theme Design Tokens
 * Strictly single source of truth for all colors, typography, spacing, and shadows.
 * NO hex values or random styling across screens.
 */

export const colors = {
  // Core Brand & Palette
  navy: '#0B1F4F',          // Primary text, dark cards, active chip
  blue: '#1D3FA6',          // Primary buttons, links, selected outline
  blueBright: '#4C7DFF',    // Avatar ring on profile
  bg: '#F4F6FB',            // Screen background
  soft: '#E4EBFB',          // Tints: active tab, avatar bg, soft buttons
  muted: '#4A5675',         // Secondary text
  white: '#FFFFFF',

  // Status & Semantic Indicators
  green: '#12794A',         // Present / done / success
  red: '#C0392B',           // Absent / destructive
  redDot: '#E5484D',        // Bell badge, missed/absent status dot
  amber: '#E8A317',         // Ongoing dot / warning
  greyDot: '#B7C0D3',       // Upcoming dot

  // Structural & Dividers
  divider: '#EEF1F7',       // Row dividers, segmented track
  line: '#D5DCEC',          // Timeline line, input border

  // Gradients (tuples for LinearGradient)
  heroGradient: ['#0B1F4F', '#12308A'],      // Home hero card (160 deg)
  profileGradient: ['#081742', '#0E2670'],   // Profile card (160 deg)

  // Contrast Text on Dark Surfaces
  onDarkMuted: '#C9D4F0',
  onDarkSubtle: '#E3EAFB',

  // Semantic Tag/Badge Pairs { bg, text }
  tags: {
    amber: { bg: '#FDF0D0', text: '#7A4B00' },
    red: { bg: '#FDE3E0', text: '#9B1C1C' },
    blue: { bg: '#E4EBFB', text: '#1D3FA6' },
    green: { bg: '#DDF3E6', text: '#12794A' },
  },

  // Legacy mappings for backwards-compatibility
  primary: '#1D3FA6',
  primaryDark: '#0B1F4F',
  surface: '#FFFFFF',
  border: '#D5DCEC',
  text: '#0B1F4F',
  textSecondary: '#4A5675',
  status: {
    upcoming: '#B7C0D3',
    ongoing: '#E8A317',
    completed: '#12794A',
    missed: '#E5484D',
  },
  attendance: {
    present: '#12794A',
    presentBg: '#DDF3E6',
    absent: '#C0392B',
    absentBg: '#FDE3E0',
  }
};

export const typography = {
  fontFamily: {
    medium: 'Manrope_500Medium',
    semiBold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extraBold: 'Manrope_800ExtraBold',
  },
  // Scale matching approved design
  screenTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Manrope_800ExtraBold',
    color: colors.navy,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Manrope_800ExtraBold',
    color: colors.navy,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Manrope_800ExtraBold',
    color: colors.navy,
  },
  body: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Manrope_700Bold',
    color: colors.navy,
  },
  secondary: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.muted,
  },
  micro: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.muted,
  },
  statBig: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: 'Manrope_800ExtraBold',
    color: colors.navy,
  },
  statHero: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: 'Manrope_800ExtraBold',
    color: colors.white,
  }
};

export const spacing = {
  screenPadding: 16,
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 18,
  gutter: 20,
  section: 22,
};

export const radius = {
  hero: 26,
  card: 20,
  row: 14,
  button: 16,
  pill: 14,
  tag: 10,
  nav: 22,
  avatar: 9999,
};

export const shadows = {
  nav: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  floatingPrimary: {
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  dropdownMenu: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  card: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
};

export default { colors, typography, spacing, radius, shadows };
