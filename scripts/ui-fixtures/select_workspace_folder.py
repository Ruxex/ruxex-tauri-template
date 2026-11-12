#!/usr/bin/python3
"""Select a folder in the native GTK chooser through its AT-SPI interface."""

import sys
import time

import gi

gi.require_version("Atspi", "2.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Atspi, Gdk


def children(node):
    if node is None:
        return []
    try:
        count = node.get_child_count()
    except Exception:
        return []
    result = []
    for index in range(count):
        try:
            child = node.get_child_at_index(index)
            if child is not None:
                result.append(child)
        except Exception:
            pass
    return result


def find_chooser():
    desktop = Atspi.get_desktop(0)
    pending = [desktop]
    while pending:
        node = pending.pop()
        try:
            role = (node.get_role_name() or "").lower()
        except Exception:
            role = ""
        try:
            name = (node.get_name() or "").lower()
        except Exception:
            name = ""
        if (
            role in {"dialog", "file chooser"}
            and ("workspace" in name or role == "file chooser")
            and find_accept_button(node)
        ):
            return node
        pending.extend(reversed(children(node)))
    return None


def press_key(keyval, synth_type):
    if not Atspi.generate_keyboard_event(keyval, None, synth_type):
        raise RuntimeError(f"unable to send accessibility key event {keyval}")


def find_accept_button(node):
    pending = [node]
    while pending:
        current = pending.pop()
        role = (current.get_role_name() or "").lower()
        name = (current.get_name() or "").lower()
        if role in {"push button", "button"} and name in {
            "select",
            "open",
            "select folder",
        }:
            return current
        pending.extend(reversed(children(current)))
    return None


def find_action(node, action_name):
    pending = [(node, 0)]
    while pending:
        current, _ = pending.pop()
        try:
            action = current.get_action_iface()
            for index in range(current.get_n_actions()):
                if action.get_action_name(index) == action_name:
                    return action, index
        except Exception:
            pass
        pending.extend((child, 0) for child in reversed(children(current)))
    return None


def find_visible_entry(node):
    pending = [node]
    while pending:
        current = pending.pop()
        try:
            states = current.get_state_set()
            if (
                "EditableText" in current.get_interfaces()
                and states.contains(Atspi.StateType.SHOWING)
                and states.contains(Atspi.StateType.EDITABLE)
            ):
                return current
        except Exception:
            pass
        pending.extend(reversed(children(current)))
    return None


def main():
    if len(sys.argv) != 2:
        raise RuntimeError("usage: select_workspace_folder.py ABSOLUTE_PATH")
    folder = sys.argv[1]
    deadline = time.monotonic() + 30
    chooser = None
    while time.monotonic() < deadline:
        chooser = find_chooser()
        if chooser is not None:
            break
        time.sleep(0.1)
    if chooser is None:
        raise RuntimeError("native workspace folder chooser did not appear")

    location_action = find_action(chooser, "show_location")
    if location_action is None:
        raise RuntimeError("workspace chooser has no accessible Show Location action")
    action, index = location_action
    if not action.do_action(index):
        raise RuntimeError("unable to open the workspace chooser location field")
    time.sleep(0.2)
    entry = find_visible_entry(chooser)
    if entry is None:
        raise RuntimeError("workspace chooser location field is not accessible")
    if not entry.get_editable_text_iface().set_text_contents(folder):
        raise RuntimeError("unable to enter workspace folder path")
    press_key(Gdk.KEY_Return, Atspi.KeySynthType.PRESSRELEASE)
    time.sleep(0.5)

    button = find_accept_button(chooser)
    if button is None:
        raise RuntimeError("workspace chooser has no accessible Select/Open button")
    action = button.get_action()
    if not action.do_action(0):
        raise RuntimeError("unable to activate workspace chooser button")
    print(f"Selected workspace folder through AT-SPI: {folder}")


if __name__ == "__main__":
    main()
