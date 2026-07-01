from typing import Dict, List, Optional, Tuple

import pandas as pd


def normalize_column_name(col: str) -> str:
    """Clean up column names for matching."""
    if not isinstance(col, str):
        return ""
    return col.strip().upper().replace(" ", "_")


def map_sf1_columns(df_columns: List[str]) -> Dict[str, Optional[str]]:
    """Map SF1 sheet columns to database field names."""
    mapping = {
        'lrn': None,
        'first_name': None,
        'last_name': None,
        'grade_level': None,
        'section': None,
    }

    aliases = {
        'lrn': ['LRN', 'LEARNER_REFERENCE_NUMBER', 'REFERENCE_NUMBER', 'ID'],
        'first_name': ['FIRST_NAME', 'FIRSTNAME', 'GIVEN_NAME', 'NAME_FIRST', 'FIRST'],
        'last_name': ['LAST_NAME', 'LASTNAME', 'SURNAME', 'FAMILY_NAME', 'NAME_LAST', 'LAST'],
        'grade_level': ['GRADE_LEVEL', 'GRADE', 'GRADE_LVL', 'LEVEL', 'YEAR_LEVEL'],
        'section': ['SECTION', 'CLASS', 'DIVISION', 'GROUP'],
    }

    normalized_cols = [normalize_column_name(c) for c in df_columns]

    for field, field_aliases in aliases.items():
        for idx, norm_col in enumerate(normalized_cols):
            if norm_col in field_aliases:
                mapping[field] = df_columns[idx]
                break
            for alias in field_aliases:
                if alias in norm_col or norm_col in alias:
                    mapping[field] = df_columns[idx]
                    break
            if mapping[field]:
                break

    return mapping


def find_sf1_data_sheet(xl: pd.ExcelFile) -> Optional[str]:
    """Select the most likely SF1 data sheet from the workbook."""
    for sheet in xl.sheet_names:
        df_temp = pd.read_excel(xl, sheet_name=sheet, header=None)
        if not df_temp.empty and df_temp.iloc[0, 0] == "School Form 1 (SF 1) School Register":
            return sheet

    for sheet in xl.sheet_names:
        df_temp = pd.read_excel(xl, sheet_name=sheet, header=None)
        if not df_temp.empty:
            return sheet

    return None


def find_header_row_idx(df_raw: pd.DataFrame) -> Optional[int]:
    """Find the row index containing the LRN / NAME header."""
    for idx, row in df_raw.iterrows():
        row_str = row.astype(str).str.upper().str.strip()
        if 'LRN' in row_str.values and 'NAME' in row_str.values:
            return idx
    return None


def build_column_map(header_row: pd.Series) -> Dict[str, int]:
    """Build a mapping from known header names to column indices."""
    col_map: Dict[str, int] = {}
    for idx, val in enumerate(header_row):
        if not isinstance(val, str):
            continue
        val_clean = val.strip().upper()
        if 'LRN' in val_clean:
            col_map['lrn'] = idx
        elif 'NAME' in val_clean and 'LAST' in val_clean:
            col_map['name'] = idx
        elif 'SEX' in val_clean:
            col_map['sex'] = idx
        elif 'BIRTH' in val_clean and 'DATE' in val_clean:
            col_map['birthdate'] = idx
        elif 'AGE' in val_clean and 'FRIDAY' in val_clean:
            col_map['age'] = idx
        elif 'MOTHER TONGUE' in val_clean:
            col_map['mother_tongue'] = idx
        elif 'IP' in val_clean and 'ETHNIC' in val_clean:
            col_map['ip'] = idx
        elif 'RELIGION' in val_clean:
            col_map['religion'] = idx
        elif 'BARANGAY' in val_clean:
            col_map['barangay'] = idx
        elif 'MUNICIPALITY' in val_clean or 'CITY' in val_clean:
            col_map['municipality'] = idx
        elif 'PROVINCE' in val_clean:
            col_map['province'] = idx
    return col_map


def extract_grade_section_metadata(df_raw: pd.DataFrame, header_row_idx: int) -> Tuple[Optional[str], Optional[str]]:
    """Extract grade level and section from the metadata rows above the header."""
    grade_level = None
    section = None
    for idx in range(0, header_row_idx):
        row = df_raw.iloc[idx].astype(str).str.strip()
        for j, val in enumerate(row):
            val_upper = val.upper()
            if 'GRADE LEVEL' in val_upper and j + 1 < len(row):
                candidate = row[j + 1]
                if candidate and candidate != 'nan':
                    grade_level = candidate.strip()
            elif 'SECTION' in val_upper and j + 1 < len(row):
                candidate = row[j + 1]
                if candidate and candidate != 'nan':
                    section = candidate.strip()
    return grade_level, section


def parse_learner_row(row: pd.Series, col_map: Dict[str, int]) -> Optional[Dict[str, str]]:
    """Parse a learner row and return normalized data if valid."""
    if row.isnull().all():
        return None

    if 'lrn' not in col_map or 'name' not in col_map:
        return None

    lrn_idx = col_map['lrn']
    name_idx = col_map['name']

    lrn_val = row[lrn_idx] if lrn_idx < len(row) else None
    if pd.isna(lrn_val) or not isinstance(lrn_val, (int, float, str)):
        return None

    lrn = str(lrn_val).strip()
    if not lrn.isdigit() or len(lrn) < 10:
        return None

    name_val = row[name_idx] if name_idx < len(row) else None
    if pd.isna(name_val) or not isinstance(name_val, str):
        return None

    name_parts = [part.strip() for part in name_val.strip().split(',') if part.strip()]
    if len(name_parts) < 2:
        return None

    last_name = name_parts[0]
    first_and_middle = name_parts[1]
    first_name = first_and_middle.split()[0] if first_and_middle.split() else ''

    return {
        'lrn': lrn,
        'first_name': first_name,
        'last_name': last_name,
    }
