/**
 * BJCC Design System — matches the web frontend exactly.
 * Deep space dark palette + purple/cyan/pink accent trio.
 */

export const Colors = {
  bg0: '#0a0520',
  bg1: '#1a1040',
  bg2: '#0a0520',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHover: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(255,255,255,0.15)',
  accent: '#7C3AED',       // purple
  accent2: '#06B6D4',      // cyan
  accent3: '#F472B6',      // pink
  accentSoft: '#a78bfa',   // soft violet
  accentMuted: '#c4b5fd',  // light violet
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.3)',
  textLabel: 'rgba(255,255,255,0.4)',
  inputBg: 'rgba(255,255,255,0.04)',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputFocus: 'rgba(124,58,237,0.6)',
  userMsgColor: '#a78bfa',
  botMsgColor: '#06B6D4',
  cardGradientStart: 'rgba(255,255,255,0.07)',
  cardGradientEnd: 'rgba(255,255,255,0.03)',
  resultHoverBorder: 'rgba(6,182,212,0.3)',
  accentBtnBg: 'rgba(124,58,237,0.2)',
  accentBtnBorder: 'rgba(124,58,237,0.4)',
  sectionColors: {
    facts: 'rgba(59,130,246,0.15)',
    issues: 'rgba(168,85,247,0.15)',
    petitioner_arguments: 'rgba(236,72,153,0.15)',
    respondent_arguments: 'rgba(245,158,11,0.15)',
    analysis_of_law: 'rgba(16,185,129,0.15)',
    precedent_analysis: 'rgba(99,102,241,0.15)',
    court_reasoning: 'rgba(14,165,233,0.15)',
    conclusion: 'rgba(34,197,94,0.15)',
  },
  sectionBorders: {
    facts: '#3b82f6',
    issues: '#a855f7',
    petitioner_arguments: '#ec4899',
    respondent_arguments: '#f59e0b',
    analysis_of_law: '#10b981',
    precedent_analysis: '#6366f1',
    court_reasoning: '#0ea5e9',
    conclusion: '#22c55e',
    case_study: '#7C3AED',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
};

export const Shadows = {
  card: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  button: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
};

export const Durations = {
  fast: 200,
  normal: 350,
  slow: 600,
  entrance: 900,
};

// Background gradient for all screens
export const BG_GRADIENT = ['#0a0520', '#1a1040', '#0a0520'];
export const PRIMARY_GRADIENT = ['#7C3AED', '#06B6D4'];
export const PRIMARY_GRADIENT_3 = ['#7C3AED', '#5B21B6', '#06B6D4'];
