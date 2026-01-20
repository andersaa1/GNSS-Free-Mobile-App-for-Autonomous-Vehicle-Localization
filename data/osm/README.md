# Estonia map data

## Source

- Data: © OpenStreetMap contributors, ODbL 1.0
- Provider: Geofabrik (https://www.geofabrik.de/)
- Extract: `estonia-latest.osm.pbf`
- Download date: 2026-01-20

## Processing

Using `osmium-tool` (https://osmcode.org/osmium-tool/)

Filtering road data:
```bash
osmium tags-filter \
  estonia-latest.osm.pbf \
  w/highway=trunk,primary,secondary,tertiary,unclassified,residential,living_street,service,
  trunk_link,primary_link,secondary_link,tertiary_link \
  -o estonia-roads.osm.pbf
```

Converting data to geoJSON:
```bash
osmium export estonia-roads.osm.pbf \
  --geometry-types=linestring \
  --output-format=geojson \
  -o estonia-roads.geojson
```

## Output files after processing

* estonia-roads.osm.pbf (filtered OSM data with only road data)
* estonia-roads.geojson (~62 MB)
* estonia-roads.geojson.gz (~13 MB)

## Intentend use

Adding road data to the map for road-constrained particle filtering.

## License

This data is a modified version of the original OpenStreetMap data.
Modifications include: filtering by highway tags, inclusion of *_link roads, conversion to GeoJSON format, and removal of non-drivable ways.

This data is made available under the Open Database License: http://opendatacommons.org/licenses/odbl/1.0/. Any rights in individual contents of the database are licensed under the Database Contents License: http://opendatacommons.org/licenses/dbcl/1.0/