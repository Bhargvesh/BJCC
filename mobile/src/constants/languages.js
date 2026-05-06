/**
 * BJCC Language constants — 22 scheduled Indian languages.
 */

export const BJCC_LANGUAGES = [
  { code: 'en',  label: 'English',    native: 'English',      rtl: false },
  { code: 'hi',  label: 'Hindi',      native: 'हिंदी',         rtl: false },
  { code: 'bn',  label: 'Bengali',    native: 'বাংলা',         rtl: false },
  { code: 'te',  label: 'Telugu',     native: 'తెలుగు',        rtl: false },
  { code: 'mr',  label: 'Marathi',    native: 'मराठी',         rtl: false },
  { code: 'ta',  label: 'Tamil',      native: 'தமிழ்',         rtl: false },
  { code: 'gu',  label: 'Gujarati',   native: 'ગુજરાતી',       rtl: false },
  { code: 'kn',  label: 'Kannada',    native: 'ಕನ್ನಡ',         rtl: false },
  { code: 'ml',  label: 'Malayalam',  native: 'മലയാളം',        rtl: false },
  { code: 'pa',  label: 'Punjabi',    native: 'ਪੰਜਾਬੀ',        rtl: false },
  { code: 'or',  label: 'Odia',       native: 'ଓଡ଼ିଆ',         rtl: false },
  { code: 'as',  label: 'Assamese',   native: 'অসমীয়া',       rtl: false },
  { code: 'mai', label: 'Maithili',   native: 'मैथिली',        rtl: false },
  { code: 'sa',  label: 'Sanskrit',   native: 'संस्कृतम्',      rtl: false },
  { code: 'sd',  label: 'Sindhi',     native: 'سنڌي',          rtl: true  },
  { code: 'ur',  label: 'Urdu',       native: 'اردو',           rtl: true  },
  { code: 'ks',  label: 'Kashmiri',   native: 'کٲشُر',          rtl: true  },
  { code: 'doi', label: 'Dogri',      native: 'डोगरी',         rtl: false },
  { code: 'kok', label: 'Konkani',    native: 'कोंकणी',        rtl: false },
  { code: 'mni', label: 'Manipuri',   native: 'মৈতৈলোন্',      rtl: false },
  { code: 'ne',  label: 'Nepali',     native: 'नेपाली',        rtl: false },
  { code: 'bo',  label: 'Bodo',       native: 'बड़ो',           rtl: false },
];

export const LABEL_TO_LANG = Object.fromEntries(
  BJCC_LANGUAGES.map(l => [l.label, l.code])
);

export const TTS_LOCALE_MAP = {
  en:  'en-IN',
  hi:  'hi-IN',
  bn:  'bn-IN',
  te:  'te-IN',
  mr:  'mr-IN',
  ta:  'ta-IN',
  gu:  'gu-IN',
  kn:  'kn-IN',
  ml:  'ml-IN',
  pa:  'pa-IN',
  or:  'or-IN',
  as:  'as-IN',
  mai: 'hi-IN',
  sa:  'hi-IN',
  sd:  'ur-IN',
  ur:  'ur-IN',
  ks:  'hi-IN',
  doi: 'hi-IN',
  kok: 'mr-IN',
  mni: 'bn-IN',
  ne:  'ne-IN',
  bo:  'hi-IN',
};
