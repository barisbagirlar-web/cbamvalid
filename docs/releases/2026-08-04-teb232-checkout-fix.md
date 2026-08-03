# Teb232 checkout fix acceptance

Release is accepted only when all conditions are true:

- live Content-Security-Policy includes `https://public.profitwell.com`
- `/credits/buy?caseId=...` renders the case-specific payment screen without React hydration error #418
- fallback working-files link targets `/cases`
- the obsolete Iskenderun working file `case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8` is absent
- the Teb232 working-files list contains exactly the four canonical controlled cases
