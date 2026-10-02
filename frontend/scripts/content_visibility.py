"""Temporary display rules; keep the underlying CMS/source records intact."""
import re
import unicodedata


HIDDEN_PARTNER_IDS = {'harahachi'}
CO_DEVELOPMENT_PARTNER_IDS = {'riams'}


def public_company_name(value):
    name = str(value or '')
    normalized = re.sub(r'\s+', '', unicodedata.normalize('NFKC', name)).casefold()
    return '' if any(part in normalized for part in ('ハラハチ', 'harahachi')) else name


def partner_group(row):
    """Classify existing records without requiring a CMS schema change."""
    partner_id = str(row.get('id') or '').casefold()
    name = re.sub(r'\s+', '', unicodedata.normalize('NFKC', str(row.get('name') or ''))).casefold()
    if partner_id in CO_DEVELOPMENT_PARTNER_IDS or any(part in name for part in ('リアムス', 'riams')):
        return 'co-development'
    return 'long-term'
