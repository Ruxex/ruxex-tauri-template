import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTROL_NAMES = ("button", "input", "select", "textarea")
CONTROL_START = re.compile(r"<(" + "|".join(CONTROL_NAMES) + r")\b")


def production_control_tags():
    for path in sorted((ROOT / "src").rglob("*.tsx")):
        if path.name.endswith(".test.tsx"):
            continue

        source = path.read_text(encoding="utf-8")
        for match in CONTROL_START.finditer(source):
            index = match.start()
            cursor = match.end()
            brace_depth = 0
            quote = None
            while cursor < len(source):
                character = source[cursor]
                if quote:
                    if character == quote and source[cursor - 1] != "\\":
                        quote = None
                elif character in ('"', "'", "`"):
                    quote = character
                elif character == "{":
                    brace_depth += 1
                elif character == "}" and brace_depth:
                    brace_depth -= 1
                elif character == ">" and brace_depth == 0:
                    break
                cursor += 1

            line = source.count("\n", 0, index) + 1
            yield path.relative_to(ROOT), line, source, index, cursor


def has_explicit_name(tag):
    return "aria-label=" in tag or "aria-labelledby=" in tag


def is_wrapped_by_label(source, index):
    return source.rfind("<label", 0, index) > source.rfind("</label>", 0, index)


def button_has_visible_name(source, tag_end):
    closing = source.find("</button", tag_end)
    if closing < 0:
        return False

    content = source[tag_end + 1 : closing]
    content = re.sub(r"\{\s*(?:false|null|undefined)?\s*\}", "", content)
    content = re.sub(r"<[^>]*>", "", content)
    return bool(content.strip()) or bool(re.search(r"\bt\s*\(", content))


class AccessibilityLabelTests(unittest.TestCase):
    def test_production_controls_have_accessible_names(self):
        unlabeled = [
            f"{path}:{line}: <{source[index:tag_end].split()[0][1:]}...>"
            for path, line, source, index, tag_end in production_control_tags()
            if not has_explicit_name(source[index:tag_end])
            and (
                source[index + 1 : index + 7] != "button"
                or not button_has_visible_name(source, tag_end)
            )
            and (
                source[index + 1 : index + 7] == "button"
                or not is_wrapped_by_label(source, index)
            )
        ]
        self.assertEqual([], unlabeled, "Controls without an accessible name:\n" + "\n".join(unlabeled))


if __name__ == "__main__":
    unittest.main()
