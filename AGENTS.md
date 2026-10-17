# AGENTS.md

Proyecto: **Planificador Familiar** (PWA + Supabase), en `/home/cesar/app-planificador-familiar`.

Al empezar una sesión nueva:
1. **Lee `ORDENES.txt`** — es la guía de trabajo: estado actual, acceso a los
   datos y el **siguiente paso** a ejecutar. Es el fichero que manda.
2. **Lee `PROGRESO.md`** — historial detallado de lo que ya está hecho.
3. Responde al usuario siempre en español.

Al terminar de avanzar en algo:
- Actualiza `ORDENES.txt` (marca el paso como hecho y añade apuntes con fecha).
- Actualiza `PROGRESO.md` si hay cambios importantes.
- Haz commit: `git add -A && git commit -m "lo que se haya hecho"`.
