#!/usr/bin/env bash
set -euo pipefail

SOUND_DIR="public/sounds"
TMP_DIR="${TMPDIR:-/tmp}/impregnable-fortress-sounds"

mkdir -p "$SOUND_DIR" "$TMP_DIR"

download_zip() {
  local name="$1"
  local url="$2"
  local out="$TMP_DIR/$name.zip"
  if [ ! -f "$out" ]; then
    curl -L -o "$out" "$url"
  fi
}

extract_convert() {
  local zip_name="$1"
  local source_path="$2"
  local output_name="$3"
  local tmp_ogg="$TMP_DIR/$output_name.ogg"

  unzip -p "$TMP_DIR/$zip_name.zip" "$source_path" > "$tmp_ogg"
  ffmpeg -y -loglevel error -i "$tmp_ogg" -codec:a libmp3lame -q:a 4 "$SOUND_DIR/$output_name.mp3"
}

command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v unzip >/dev/null || { echo "unzip is required" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required to convert Kenney OGG files to MP3" >&2; exit 1; }

download_zip "kenney_interface" "https://kenney.nl/media/pages/assets/interface-sounds/d23a84242e-1677589452/kenney_interface-sounds.zip"
download_zip "kenney_digital" "https://kenney.nl/media/pages/assets/digital-audio/7492b26e77-1677590265/kenney_digital-audio.zip"
download_zip "kenney_scifi" "https://kenney.nl/media/pages/assets/sci-fi-sounds/e3af5f7ed7-1677589334/kenney_sci-fi-sounds.zip"
download_zip "kenney_impact" "https://kenney.nl/media/pages/assets/impact-sounds/8aa7b545c9-1677589768/kenney_impact-sounds.zip"
download_zip "opengameart_wind" "https://opengameart.org/sites/default/files/wind.zip"

extract_convert "kenney_impact" "Audio/impactMining_000.ogg" "mine_click"
extract_convert "kenney_digital" "Audio/powerUp1.ogg" "hrc_upgrade"
extract_convert "kenney_impact" "Audio/impactMetal_heavy_000.ogg" "wall_hit"
extract_convert "kenney_digital" "Audio/lowDown.ogg" "nuke_launch"
extract_convert "kenney_scifi" "Audio/explosionCrunch_004.ogg" "nuke_explosion"
extract_convert "kenney_scifi" "Audio/computerNoise_000.ogg" "robot_work"
extract_convert "opengameart_wind" "wind/Wind2.ogg" "windy_active"
extract_convert "kenney_digital" "Audio/zapThreeToneUp.ogg" "admin_cheat"
extract_convert "kenney_impact" "Audio/impactGeneric_light_000.ogg" "weapon_stone"
extract_convert "kenney_impact" "Audio/impactMetal_light_001.ogg" "weapon_axe"
extract_convert "kenney_impact" "Audio/impactMetal_light_003.ogg" "weapon_dagger"
extract_convert "kenney_scifi" "Audio/laserSmall_000.ogg" "weapon_bullet"
extract_convert "kenney_digital" "Audio/zapTwoTone2.ogg" "weapon_lightning"
extract_convert "kenney_scifi" "Audio/forceField_000.ogg" "weapon_gravity"
extract_convert "kenney_scifi" "Audio/laserLarge_000.ogg" "satellite_laser"

cat > "$SOUND_DIR/LICENSE.txt" <<'LICENSE'
Sound assets are extracted from Kenney audio packs and converted to MP3.
Additional wind sound is extracted from OpenGameArt "Wind" by IgnasD.
Sources: https://kenney.nl/assets, https://opengameart.org/content/wind
License: Creative Commons CC0 1.0 Universal (Public Domain)
License URL: https://creativecommons.org/publicdomain/zero/1.0/

Mappings:
- mine_click.mp3: Kenney Impact Sounds / Audio/impactMining_000.ogg
- hrc_upgrade.mp3: Kenney Digital Audio / Audio/powerUp1.ogg
- wall_hit.mp3: Kenney Impact Sounds / Audio/impactMetal_heavy_000.ogg
- nuke_launch.mp3: Kenney Digital Audio / Audio/lowDown.ogg
- nuke_explosion.mp3: Kenney Sci-fi Sounds / Audio/explosionCrunch_004.ogg
- robot_work.mp3: Kenney Sci-fi Sounds / Audio/computerNoise_000.ogg
- windy_active.mp3: OpenGameArt "Wind" by IgnasD / wind/Wind2.ogg
- admin_cheat.mp3: Kenney Digital Audio / Audio/zapThreeToneUp.ogg
- weapon_stone.mp3: Kenney Impact Sounds / Audio/impactGeneric_light_000.ogg
- weapon_axe.mp3: Kenney Impact Sounds / Audio/impactMetal_light_001.ogg
- weapon_dagger.mp3: Kenney Impact Sounds / Audio/impactMetal_light_003.ogg
- weapon_bullet.mp3: Kenney Sci-fi Sounds / Audio/laserSmall_000.ogg
- weapon_lightning.mp3: Kenney Digital Audio / Audio/zapTwoTone2.ogg
- weapon_gravity.mp3: Kenney Sci-fi Sounds / Audio/forceField_000.ogg
- satellite_laser.mp3: Kenney Sci-fi Sounds / Audio/laserLarge_000.ogg
LICENSE

echo "Downloaded and converted sounds into $SOUND_DIR"
