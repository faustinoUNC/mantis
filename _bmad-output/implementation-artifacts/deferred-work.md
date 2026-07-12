# Trabajo diferido

- **Tests unitarios de `codigo/shared/utils/cuil.ts`** (diferido en el fix v1.1 de STORY-923, 2026-07-12): el repo no tiene infraestructura de tests; el placeholder inválido `20301234567` que originó el bug se habría atrapado con un test de `cuilValido`/`errorCuil` (válidos/inválidos/longitud/normalización/ejemplos de placeholders). Si algún día se agrega un runner de tests, este archivo es el primer candidato.
