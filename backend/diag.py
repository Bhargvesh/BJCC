with open('app/routes/innovation.py', encoding='utf-8') as f:
    content = f.read()

count = content.count('_I18N_DOC_FIELDS')
print('Occurrences of _I18N_DOC_FIELDS:', count)

# check for first full_summary after the i18n dict
idx = content.find('_I18N_DOC_FIELDS')
sub = content[idx:idx+5000]
has_full_summary_in_first_hi = 'full_summary' in sub[:2000]
print('full_summary in first 2000 chars of i18n dict:', has_full_summary_in_first_hi)

# check hindi judgment sections  
has_hi_judgment = 'judgment_sections' in content and 'जस्टिस' in content
print('Hindi judgment_sections present:', has_hi_judgment)

# check the localize copy loop
check_str = 'for k, v in i18n'
has_localize_loop = check_str in content
print('localize loop present:', has_localize_loop)

# count how many times "judgment_sections" appears in the i18n section
i18n_start = content.find('_I18N_DOC_FIELDS')
localize_start = content.find('def _localize_doc_payload')
i18n_section = content[i18n_start:localize_start]
jcount = i18n_section.count('judgment_sections')
print('judgment_sections count in i18n dict:', jcount)
