#!/bin/bash
set -e
cd "`dirname "$0"`"
cp wsgi_backend.py /usr/lib/wsgi-bin
cp vg_to_opt_trace.py /var/spp/lib
cp auto_everything.sh /var/spp/lib
