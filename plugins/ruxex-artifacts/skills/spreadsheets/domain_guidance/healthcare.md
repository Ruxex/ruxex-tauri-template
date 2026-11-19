# Healthcare guidance

Use for clinical records, care delivery, patient or encounter analysis, and healthcare administration. Do not apply clinical conventions to every workbook made by a healthcare organization. For healthcare-company budgets and forecasts, use [Finance guidance](financial_models.md) and add healthcare definitions only when needed.

- Keep raw clinical or administrative records separate from derived calculations when the task or refresh workflow requires it. Never overwrite original records during cleaning.
- Preserve source definitions, periods, denominators, units, and codes for clinical indicators such as length of stay or readmission rates.
- Include units for measurements, such as kg, °C, mg/dL, or bpm, and identify time periods and encounter basis.
- Use thresholds or target ranges only when the task requires them and an applicable source or protocol supplies them. Do not invent clinical advice or universal normal ranges.
- Keep code definitions or legends available when abbreviations are not clear from the headers.
- For critical clinical calculations, compare results with an authoritative source or qualified review when available. State when such verification could not be performed.
- Preserve privacy and minimize patient-identifying values in outputs. Do not disclose sensitive source rows unless the user requests them and the context authorizes it.
- Use a separate correction field or documented process when a source value needs correction. Preserve the original value and provenance.
