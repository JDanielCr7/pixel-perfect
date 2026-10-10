# Simulador de escenarios – MotoClean

## Estructura
- `src/lib/simulation/types.ts` – SimulationParameters, SimulationResults, SimulationScenario, HistoricalBaseline, SensitivityResult.
- `src/lib/simulation/simulationService.ts` – motor matemático puro (sin React). Fórmulas:
  - Demanda base = Σ demanda diaria en días operativos (manual, promedio histórico o tendencia lineal por mínimos cuadrados).
  - Ajustada = base × (1 + crecimiento) × (1 + ajuste climático ponderado); efectiva = ajustada × (1 − cancelación).
  - Atendidos = min(efectiva, lavadores × capacidad × días operativos).
  - Ingresos = atendidos × precio efectivo (mezcla y descuento). Costos operativos = variables + fijos del periodo.
  - Utilidad operativa, margen, punto de equilibrio = ⌈fijos / (precio − costo variable)⌉, ROI = utilidad / inversión, recuperación = inversión / utilidad mensual.
  - La inversión nunca se incluye en los costos operativos.
- `src/lib/simulation/historical.ts` – estadística descriptiva de las reservas guardadas.
- `src/lib/simulation/exportService.ts` – CSV/JSON con columnas snake_case.
- Pruebas: `src/lib/simulation/simulationService.test.ts`.

## Integración futura con Python y PostgreSQL
```text
Registros → PostgreSQL → API REST (FastAPI) → Python/Pandas → modelo predictivo → resultados → dashboard
```
1. Exponer `POST /simulate` que reciba `SimulationParameters` (JSON idéntico al exportado) y devuelva `SimulationResults`.
2. Reemplazar la llamada `simulate(params, baseline)` por un `fetch` con la misma firma (async).
3. Las predicciones de machine learning deben devolverse en un campo separado (p. ej. `ml_forecast`) y mostrarse con su propia etiqueta, nunca mezcladas con los resultados de la simulación matemática.

Lectura en Python:
```python
import pandas as pd
esc = pd.read_csv("motoclean_escenarios_*.csv")
sim = pd.read_json("motoclean_simulacion_*.json", typ="series")
```
