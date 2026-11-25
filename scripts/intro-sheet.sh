#!/bin/bash
# usage: scripts/intro-sheet.sh <round-dir> <out.png> t1 t2 ... (renders stills, builds a contact sheet, 2 columns)
dir=$1; out=$2; shift 2
node scripts/intro-stills.mjs "$dir" "$@" 2>&1 | grep -v "^t "
args=(); n=0
for t in "$@"; do args+=(-i "$dir/t$(printf %05d ${t%.*}).png"); n=$((n+1)); done
fc=""; rows=$(( (n+1)/2 )); labels=""
for ((r=0;r<rows;r++)); do a=$((2*r)); b=$((2*r+1)); if [ $b -lt $n ]; then fc+="[$a][$b]hstack[r$r];"; else fc+="[$a]pad=iw*2:ih[r$r];"; fi; labels+="[r$r]"; done
fc+="${labels}vstack=inputs=$rows,scale=1800:-1"
ffmpeg -loglevel error -y "${args[@]}" -filter_complex "$fc" "$out"
