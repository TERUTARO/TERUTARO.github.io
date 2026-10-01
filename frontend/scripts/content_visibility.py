"""Temporary display rules; keep the underlying CMS/source records intact."""
import re
import unicodedata


HIDDEN_PARTNER_IDS = {'harahachi'}


def public_company_name(value):
    name = str(value or '')
    normalized = re.sub(r'\s+', '', unicodedata.normalize('NFKC', name)).casefold()
    return '' if any(part in normalized for part in ('ハラハチ', 'harahachi')) else name
