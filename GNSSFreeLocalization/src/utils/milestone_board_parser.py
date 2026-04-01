import json
import re
from typing import Any

import pandas as pd

SIGN_CODES = {"623c", "631", "632", "633", "645"}

VALID_PATTERN = re.compile(
    r"^[A-Za-zÕÄÖÜõäöü][A-Za-zÕÄÖÜõäöü0-9.\-()/', ]*\s+[1-9]\d*$"
)


REMOVE_ENDING_WORDS = (
    "keskus",
    "linnaosa",
    "vallavalitsus",
    "alevik",
    "rdtj.",
)


def load_geojson_to_dataframe(path: str) -> pd.DataFrame:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows: list[dict[str, Any]] = []

    for feature in data["features"]:
        props = feature["properties"]
        geom = feature["geometry"]

        signs: list[dict[str, str]] = []
        seen: set[tuple[str, str]] = set()

        for i in range(1, 9):
            code = props.get(f"lm{i}")
            text = props.get(f"lm{i}_tekst")

            if code not in SIGN_CODES or text is None:
                continue

            text = str(text).strip()
            key = (str(code), text)

            if key in seen:
                continue

            seen.add(key)
            signs.append({
                "slot": i,
                "code": str(code),
                "text": text,
            })

        rows.append({
            "oid": props.get("oid"),
            "tee_number": props.get("tee_number"),
            "tee_nimi": props.get("tee_nimi"),
            "km": props.get("km"),
            "direction": props.get("viitepunkti_suund_nvps_xv"),
            "x": geom["coordinates"][0],
            "y": geom["coordinates"][1],
            "signs": signs,
        })

    return pd.DataFrame(rows)


def dataframe_to_geojson(df: pd.DataFrame, output_path: str) -> None:
    features = []

    for _, row in df.iterrows():
        feature = {
            "type": "Feature",
            "properties": {
                "oid": row["oid"],
                "tee_number": row["tee_number"],
                "tee_nimi": row["tee_nimi"],
                "km": row["km"],
                "direction": row["direction"],
                "signs": row["signs"],
            },
            "geometry": {
                "type": "Point",
                "coordinates": [row["x"], row["y"]],
            },
        }

        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "name": "milestone_boards_cleaned",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:EPSG::3301"}
        },
        "features": features,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)


def normalize_destination_name(name: str) -> str:
    name = name.strip().lower()

    # e263 tartu / e 263 tartu -> tartu
    name = re.sub(r"^e\s*\d+\s+", "", name, flags=re.IGNORECASE)

    # toll/clo tartu -> tartu
    name = re.sub(r"^toll/clo\s+", "", name, flags=re.IGNORECASE)

    # otse tartu -> tartu
    name = re.sub(r"^otse\s+", "", name, flags=re.IGNORECASE)

    # mnt. -> mnt
    name = re.sub(r"\bmnt\.\b", "mnt", name, flags=re.IGNORECASE)
    name = re.sub(r"\bmnt\.(?=\s|$)", "mnt", name, flags=re.IGNORECASE)

    # remove words like "tartu keskus" -> "tartu"
    for ending in REMOVE_ENDING_WORDS:
        name = re.sub(rf"\s+{re.escape(ending)}$", "", name, flags=re.IGNORECASE)

    name = re.sub(r"\s+", " ", name).strip(" ,;.-")
    return name


def parse_signs(text: str) -> list[dict[str, Any]]:
    parts = [p.strip() for p in text.split(";") if p.strip()]

    result = []
    for part in parts:
        match = re.fullmatch(r"(.+?)\s+(\d+)$", part)
        if not match:
            continue

        name = normalize_destination_name(match.group(1))
        distance = int(match.group(2))

        if not name:
            continue

        result.append({
            "destination": name,
            "distance": distance
        })

    return result


def deduplicate_group_rows(group: pd.DataFrame) -> pd.DataFrame:
    cols = ["tee_number", "tee_nimi", "direction", "x", "y", "final_text"]
    return group.drop_duplicates(subset=cols, keep="first")


def deduplicate_sign_entries(signs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique_signs = []
    seen: set[tuple[str, int]] = set()

    for sign in signs:
        key = (sign["destination"], sign["distance"])
        if key in seen:
            continue
        seen.add(key)
        unique_signs.append(sign)

    return unique_signs


def group_signs(df: pd.DataFrame) -> pd.DataFrame:
    grouped = []

    for oid, group in df.groupby("oid"):
        group = deduplicate_group_rows(group)
        first = group.iloc[0]

        signs = []
        for text in group["final_text"]:
            signs.extend(parse_signs(text))

        signs = deduplicate_sign_entries(signs)

        grouped.append({
            "oid": first["oid"],
            "tee_number": first["tee_number"],
            "tee_nimi": first["tee_nimi"],
            "km": first["km"],
            "direction": first["direction"],
            "x": first["x"],
            "y": first["y"],
            "signs": signs,
        })

    return pd.DataFrame(grouped)


def normalize_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    text = fix_leading_distances(text)
    return text


def is_clean_raw(text: str) -> bool:
    text = text.strip()
    text = re.sub(r"\s+", " ", text)

    parts = [part.strip() for part in text.split(";")]

    if not parts:
        return False

    pattern = re.compile(r"^[A-Za-zÕÄÖÜõäöü][A-Za-zÕÄÖÜõäöü0-9.\-()/' ]*\s+\d+$")
    return all(part and pattern.fullmatch(part) for part in parts)


def is_clean_normalized(text: str) -> bool:
    text = normalize_text(text)
    parts = [part.strip() for part in text.split(";")]

    if not parts:
        return False

    pattern = re.compile(r"^[A-Za-zÕÄÖÜõäöü][A-Za-zÕÄÖÜõäöü0-9.\-()/' ]*\s+\d+$")
    return all(part and pattern.fullmatch(part) for part in parts)


def flatten_signs(df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        for sign in row["signs"]:
            rows.append({
                "oid": row["oid"],
                "tee_number": row["tee_number"],
                "tee_nimi": row["tee_nimi"],
                "km": row["km"],
                "direction": row["direction"],
                "x": row["x"],
                "y": row["y"],
                "slot": sign["slot"],
                "code": sign["code"],
                "text": sign["text"],
            })

    return pd.DataFrame(rows)


def remove_leading_distances(chunk: str) -> str:
    chunk = chunk.strip()

    while True:
        if re.match(r"^[A-Za-zÕÄÖÜõäöü]", chunk):
            return chunk

        m1 = re.fullmatch(r"^\d+\s+(.+)\s+(\d+)$", chunk)
        if m1:
            chunk = f"{m1.group(1).strip()} {m1.group(2)}"
            continue

        m2 = re.fullmatch(r"^\d+([A-Za-zÕÄÖÜõäöü0-9.\-()/,' ]+?)\s+(\d+)$", chunk)
        if m2:
            chunk = f"{m2.group(1).strip()} {m2.group(2)}"
            continue

        return chunk


def fix_leading_distances(text: str) -> str:
    parts = [part.strip() for part in text.split(";")]
    fixed_parts = [remove_leading_distances(part) for part in parts if part.strip()]
    return "; ".join(fixed_parts)


def normalize_separators(text: str) -> str:
    text = text.strip()
    text = text.replace("/", ";")
    text = text.replace(",", ";")
    text = text.replace("<", "")
    text = text.replace(">", "")
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s*;\s*", "; ", text)
    return text.strip(" ;")


def keep_only_distance_chunks(text: str) -> str | None:
    text = normalize_separators(text)
    parts = [part.strip() for part in text.split(";") if part.strip()]

    valid_parts = []
    for part in parts:
        part = remove_leading_distances(part)
        if VALID_PATTERN.fullmatch(part):
            valid_parts.append(part)

    if not valid_parts:
        return None

    return "; ".join(valid_parts)


def has_any_distance(text: str) -> bool:
    if text is None:
        return False
    return bool(re.search(r"\d+", text))


def main() -> None:
    pd.set_option("display.max_columns", None)
    pd.set_option("display.max_colwidth", None)
    pd.set_option("display.width", 200)

    df = load_geojson_to_dataframe("data/original.json")

    flat_df = flatten_signs(df)
    flat_df["is_clean_raw"] = flat_df["text"].apply(is_clean_raw)
    flat_df["normalized_text"] = flat_df["text"].apply(normalize_text)
    flat_df["is_clean_after_fix"] = flat_df["normalized_text"].apply(is_clean_normalized)

    clean_df = flat_df[flat_df["is_clean_raw"]].copy()

    fixable_df = flat_df[(~flat_df["is_clean_raw"]) & (flat_df["is_clean_after_fix"])].copy()

    messy_df = flat_df[~flat_df["is_clean_after_fix"]].copy()
    messy_df["cleaned_text"] = messy_df["text"].apply(keep_only_distance_chunks)

    usable_messy_df = messy_df[messy_df["cleaned_text"].notna()].copy()
    dropped_messy_df = messy_df[messy_df["cleaned_text"].isna()].copy()

    clean_df["final_text"] = clean_df["text"]
    fixable_df["final_text"] = fixable_df["normalized_text"]
    usable_messy_df["final_text"] = usable_messy_df["cleaned_text"]

    final_clean_df = pd.concat([clean_df, fixable_df, usable_messy_df], ignore_index=True)
    final_messy_df = dropped_messy_df.copy()

    messy_with_numbers_df = final_messy_df[final_messy_df["text"].apply(has_any_distance)].copy()
    messy_without_numbers_df = final_messy_df[~final_messy_df["text"].apply(has_any_distance)].copy()

    print("\n=== DataFrame Info ===")
    print(df.info())

    print("\n=== Columns ===")
    print(df.columns)

    print("\n=== Sign slot distribution ===")
    slots = [sign["slot"] for signs in df["signs"] for sign in signs]
    print(pd.Series(slots).value_counts())

    print("\n=== Sign code distribution ===")
    codes = [sign["code"] for signs in df["signs"] for sign in signs]
    print(pd.Series(codes).value_counts())

    print("\n=== Clean signs count ===")
    print(len(clean_df))

    print("\n=== Messy signs count ===")
    print(len(messy_df))

    print("\n=== FINAL CLEAN COUNT ===")
    print(len(final_clean_df))

    print("\n=== FINAL MESSY COUNT ===")
    print(len(final_messy_df))

    grouped_df = group_signs(final_clean_df)

    print("\n=== Final grouped count ===")
    print(len(grouped_df))

    print("\n=== Messy WITH numbers ===")
    print(len(messy_with_numbers_df))

    print("\n=== Messy WITHOUT numbers (dropped) ===")
    print(len(messy_without_numbers_df))

    dataframe_to_geojson(grouped_df, "data/cleaned.json")


if __name__ == "__main__":
    main()
