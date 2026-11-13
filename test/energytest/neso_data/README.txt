Put the NESO System Frequency monthly CSV here, e.g. fnew-2023-12.csv
Source: https://www.neso.energy/data-portal/system-frequency-data  (1 s GB frequency, GMT, NESO Open Data Licence)
Then, from the project root:
  node test/energytest/grid_feeder_neso.js --file fnew-2023-12.csv --worst-day --dry-run
