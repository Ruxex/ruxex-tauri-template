#!/usr/bin/env python3
"""Snapshot a retained DOCX and check package preservation after local edits.

Part hashes check preservation; editable-part changes still require slot-level
XML/feature review and rendered page inspection. No archive is extracted.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import zipfile
from xml.etree import ElementTree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
FEATURES = {'sectPr', 'tbl', 'drawing', 'pict', 'sdt', 'bookmarkStart', 'bookmarkEnd',
            'commentRangeStart', 'commentRangeEnd', 'commentReference', 'footnoteReference',
            'endnoteReference', 'fldSimple', 'fldChar', 'instrText', 'numPr', 'ins', 'del'}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def inventory(path: Path) -> dict:
    path = path.expanduser().resolve(strict=True)
    if not path.is_file() or path.suffix.lower() not in {'.docx', '.dotx'}:
        raise ValueError('input must be a regular DOCX or DOTX file')
    parts = {}
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('duplicate package part names are ambiguous')
        if 'word/document.xml' not in names:
            raise ValueError('package is missing word/document.xml')
        for name in sorted(names):
            if name.endswith('/'):
                continue
            data = archive.read(name)
            record = {'size': len(data), 'sha256': digest(data)}
            if name.endswith(('.xml', '.rels')):
                root = ET.fromstring(data)
                record['features'] = dict(sorted(Counter(
                    node.tag.rsplit('}', 1)[-1] for node in root.iter()
                    if node.tag.startswith('{' + W + '}') and node.tag.rsplit('}', 1)[-1] in FEATURES
                ).items()))
                if root.tag == '{' + REL + '}Relationships':
                    record['relationships'] = [dict(sorted(node.attrib.items())) for node in root]
            parts[name] = record
    return {'schemaVersion': 1, 'source': {'path': str(path), 'sha256': digest(path.read_bytes())}, 'parts': parts}


def snapshot(reference: Path, manifest: Path) -> dict:
    data = inventory(reference)
    manifest = manifest.expanduser().resolve()
    if manifest.suffix.lower() != '.json':
        raise ValueError('manifest must be a separate JSON file')
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open('x', encoding='utf-8') as output:
        json.dump(data, output, indent=2, ensure_ascii=False)
        output.write('\n')
    return data


def verify(reference: Path, final: Path, manifest: Path, editable_parts: list[str]) -> dict:
    baseline = json.loads(manifest.expanduser().resolve(strict=True).read_text(encoding='utf-8'))
    if baseline.get('schemaVersion') != 1:
        raise ValueError('unsupported template manifest version')
    source = inventory(reference)
    if source['source'] != baseline['source'] or source['parts'] != baseline['parts']:
        raise ValueError('retained reference has changed or does not match the manifest')
    parts = baseline['parts']
    editable = set(editable_parts)
    if any(part not in parts for part in editable):
        raise ValueError('each editable part must exist in the reference manifest')
    target = inventory(final)
    target_parts = target['parts']
    added = sorted(set(target_parts) - set(parts))
    removed = sorted(set(parts) - set(target_parts))
    changed = sorted(name for name in set(parts) & set(target_parts)
                     if parts[name]['sha256'] != target_parts[name]['sha256'])
    preserved_changes = sorted(set(changed) - editable)
    return {'ok': not (added or removed or preserved_changes),
            'reference': source['source'], 'output': target['source'],
            'addedParts': added, 'removedParts': removed,
            'changedPreserveOnlyParts': preserved_changes,
            'changedEditableParts': sorted(set(changed) & editable),
            'featureChanges': {name: {'before': parts[name].get('features', {}),
                                     'after': target_parts[name].get('features', {})}
                               for name in changed
                               if parts[name].get('features') != target_parts[name].get('features')},
            'limitations': ['Editable parts require slot-level structural review; their hash changes are allowed.',
                            'This check does not verify layout or the meaning of edited text.']}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for command in ('snapshot', 'verify'):
        p = sub.add_parser(command)
        p.add_argument('--reference', type=Path, required=True)
        p.add_argument('--manifest', type=Path, required=True)
        if command == 'verify':
            p.add_argument('--input', type=Path, required=True)
            p.add_argument('--editable-part', action='append', default=[])
    args = parser.parse_args()
    try:
        result = (snapshot(args.reference, args.manifest) if args.command == 'snapshot'
                  else verify(args.reference, args.input, args.manifest, args.editable_part))
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result.get('ok', True) else 1
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as error:
        parser.error(str(error))


if __name__ == '__main__':
    raise SystemExit(main())
