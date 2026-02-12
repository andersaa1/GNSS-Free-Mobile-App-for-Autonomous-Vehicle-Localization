# Generating Map Tiles

This document provides instructions on how to replicate the process of generating map tiles for Estonia.

## Prerequisites

The following software and data are required to reproduce the tile generation process.

### Data

Map data was provided by **Geofabrik**.
* Source: https://download.geofabrik.de/europe/estonia-latest.osm.pbf
* Provider: https://www.geofabrik.de/
* License: © OpenStreetMap contributors. Licensed under the Open Database License (ODbL) v1.0. https://www.openstreetmap.org/copyright

### OpenStreetTiles repository

The tile generation pipeline is provided by the **OpenMapTiles** project. The repository contains SQL schema for transforming OSM data to vector tiles, dockerized PostGIS database and tile generation scripts.
* Repository: https://github.com/openmaptiles/openmaptiles
* License: OpenMapTiles tools are open source (BSD-style licensing; see repository).

### Docker

**Docker** is required because **OpenMapTiles** runs PostgreSQL + PostGIS and the tile generation stack. For this project, Docker Desktop was used, which comes with `docker` and `docker compose` commands. </br>
Latest version of Docker Desktop can be downloaded from [here](https://www.docker.com).

### mb-util

**mb-util** is needed for converting the `.mbtiles` SQLite database into a directory structure. **Homebrew** was used to install the the CLI tools, but it can be installed another way. </br>

`brew install mbutil`

## Process

The process of generating map tiles for Estonia consists of two mapin phases. First the tiles have to be generated using OpenMapTiles repository and finally the generated tiles have to be converted to a **{z}/{x}/{y}.pbf** format.

### Step 1 - generating the .mbtiles file

1. Inside the root of **OpenMapTiles** repository, create a directory called **data**.
2. Copy or place the data extract inside **data** directory.
3. Run command `nano .env` (or other preferred text editor) to configure variables. Most importantly add MBTILES_FILE=`estonia.mbtiles`, `PBF_URL=file:///data/estonia.osm.pbf` and `MAX_ZOOM=12` (to keep the tileset a reasonable size).
4. Run command `make download-geofabrik area=estonia`. This command just generates **data.yml** file if the data is already in **data** directory.
5. Run commands `make import-osm`, `make import-data`, `make import-sql`.
6. Finally generate the map tiles by running command `make generate-tiles-pg`.
7. File `estonia.mbtiles` was generated to the **data** directory.

### Step 2 - converting .mbtiles to an offline friendly format

1. Create a directory, where you want the tiles to be generated. For example `mkdir -p export`.
2. Assuming you are in the same directory as the `estonia.mbtiles` file, run this command from the **openmaptiles** root `mb-util --image_format=pbf data/estonia.mbtiles export/estonia`.
3. Bunch of files were now created inside **export/estonia**, change directories to this directory and decompress the files by running `gzip -d -r -S .pbf .`.
4. Now you have tiles inside **export/estonia** in the correct format.

After the tiles have been converted, it might be needed to put the **.pbf** extension back to the tile files. This **Python** script can be used for this:

`python3 - <<'PY'
import os

root = "src/assets/tiles/map_tiles/estonia"
count = 0

for z in os.listdir(root):
    zp = os.path.join(root, z)
    if not os.path.isdir(zp): 
        continue
    for x in os.listdir(zp):
        xp = os.path.join(zp, x)
        if not os.path.isdir(xp):
            continue
        for name in os.listdir(xp):
            p = os.path.join(xp, name)
            if os.path.isdir(p):
                continue
            # if it already has an extension, skip
            if "." in name:
                continue
            os.rename(p, p + ".pbf")
            count += 1

print("Renamed to .pbf:", count)
PY`