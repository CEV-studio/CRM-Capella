#!/usr/bin/env python3
"""Regression checks for values read from legacy Excel workbooks."""
import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import-ancien-crm.py"
SPEC = importlib.util.spec_from_file_location("import_ancien_crm", SCRIPT)
assert SPEC and SPEC.loader
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)


class CleanExcelValuesTest(unittest.TestCase):
    def test_excel_formula_errors_are_empty_values(self):
        for value in ("#ERROR!", "#N/A", "#REF!"):
            with self.subTest(value=value):
                self.assertIsNone(IMPORTER.clean(value))

    def test_valid_text_is_preserved(self):
        self.assertEqual(IMPORTER.clean("  SARL Capella  "), "SARL Capella")

    def test_formula_only_row_is_ignored(self):
        row = {1: "#ERROR!", 2: None, 3: "", 4: "#N/A"}
        self.assertFalse(IMPORTER.has_prospect_identity(row))

    def test_prospect_with_company_but_no_contact_is_kept(self):
        self.assertTrue(IMPORTER.has_prospect_identity({2: None, 9: "CAPELLA ENERGY"}))


if __name__ == "__main__":
    unittest.main()
