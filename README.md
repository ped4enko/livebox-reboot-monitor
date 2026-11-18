# livebox-reboot-monitor

Small tools that proved an Orange Spain **Livebox Fibra** was rebooting on its own, and that the problem was not Wi-Fi load, the fiber line or overheating.

*[Resumen en español más abajo](#resumen-en-español).*

## The problem

Orange Spain FTTH, **Livebox Fibra (Arcadyan PRV3399B)**, which is a router and ONT in one box. Internet kept dying for a few minutes several times a day. The router has no event log, so all you see is "no internet", and support says "turn it off and on again".

## What the tools showed

### 1. Router vs internet: `monitor.sh`

The script pings the router and a public IP every 2 seconds and writes only state changes. Every incident had the same signature:

```
15:52:44 router=DOWN internet=DOWN   <- box disappears from the LAN
15:54:49 router=DOWN internet=ok     <- back after ~2 min
15:54:52 router=ok   internet=ok     <- (admin ping answers a few seconds later)
15:56:19 router=DOWN internet=DOWN   <- and again 3.5 min later
...
16:24:51 router=DOWN internet=DOWN
16:26:57 router=ok   internet=DOWN   <- router back, fiber still syncing
16:28:23 router=DOWN internet=DOWN   <- reboots again before internet returns
```

When the router is unreachable for about 2 minutes, the box itself is restarting. It is not an ISP outage. The uptime counter in the admin page confirmed it.

### 2. Not Wi-Fi load

Wi-Fi on the Livebox was switched off completely. All devices moved to a mesh system (TP-Link Deco) in access-point mode, wired to the Livebox. The reboots continued, including a loop between 01:53 and 02:43 when nobody was using the network.

### 3. Not the fiber, not heat: `livebox-fibra-optics-logger.js`

The Livebox admin page exposes the GPON transceiver data. The logger saved it every minute for hours. Right up to the last minute before the next crash, every value was flat:

| Metric | Range over ~4 h | Last minute before crash |
|---|---|---|
| Transceiver temperature | 47.0 - 47.7 °C | 47.7 °C |
| Supply voltage | 3.19 - 3.22 V | 3.19 V |
| Laser bias | 17.0 - 17.9 mA | 17.2 mA |
| TX power | +2.2 ... +2.9 dBm | +2.6 dBm |
| RX power | -19.1 ... -18.8 dBm | -18.9 dBm |
| RAM used | 59 - 61 % | 59 % |

There was no warning sign at all. The box just died, which points to a hardware or power-supply fault.

### 4. The worst episode

About 30 reboots between 15:52 and 17:36, roughly one every 3-4 minutes.

### Outcome

With dates and times in hand, Orange replaced the router with a **Livebox 7** (made by ZTE) without argument. Wi-Fi on the new box is off and the mesh is wired to it. Monitoring of the new router is ongoing.

## Usage

### monitor.sh (macOS / Linux)

```bash
./monitor.sh                                   # gateway 192.168.1.1, log to ./outages.log
GATEWAY=192.168.0.1 INTERVAL=2 ./monitor.sh    # other gateway
nohup ./monitor.sh >/dev/null 2>&1 &           # in the background
```

Run it on a computer that stays awake. On a laptop that goes to sleep, check `pmset -g log` (macOS) before blaming the router. Prefer a wired machine: on Wi-Fi you will also log your own Wi-Fi hiccups, although `analyze.py` labels most of those as `BLIP` / `LOCAL`.

### analyze.py

```bash
python3 analyze.py outages.log
python3 analyze.py outages.log --since "2026-11-18 15:50"
```

```
start                 duration  router down  type
2026-11-18 15:52:44      2m05s        2m08s  REBOOT?
2026-11-18 15:56:19      2m05s        2m08s  REBOOT?
...
router unreachable >= 60 s (likely reboots): 29
summary: BLIP 5, REBOOT? 19
```

| Type | Meaning |
|---|---|
| `REBOOT?` | router unreachable for at least 60 s: the box restarted (confirm with its uptime) |
| `ISP` | router reachable, internet down: line or operator side |
| `LOCAL` | router also unreachable, but for less than 60 s: Wi-Fi or LAN hiccup |
| `BLIP` | outage shorter than 10 s |

### livebox-fibra-optics-logger.js (Livebox Fibra / Arcadyan PRV3399B only)

1. Log in to `http://192.168.1.1` yourself and keep the tab open.
2. Paste the file into the DevTools console.
3. Use `lbx.table(30)`, `lbx.csv()` and `lbx.stop()` later.

The logger only reads two data files with plain GET requests. It changes no settings and never handles your password. After a reboot the session is lost, so log in and paste the script again; stored samples are kept.

Other Livebox models, including the Livebox 7, have a different admin page, so this script will not work there.

## Tips for anyone in Spain with drops

1. **Log the router and the internet separately.** Support treats "my internet drops" and "my router reboots 30 times in two hours" very differently.
2. **Check the uptime** in the router admin page right after a drop.
3. **RX power between about -8 and -27 dBm is normal for GPON.** If yours is stable and inside that range, the line is probably fine.
4. **Try another 12 V power supply** of the same rating before anything else. It is the cheapest thing to rule out.
5. **Match days:** LaLiga court-ordered blocks sometimes take down Cloudflare IP ranges, so *some* websites time out while everything else works. That is not your router.

---

## Resumen en español

Herramientas que demostraron que un **Livebox Fibra (Arcadyan PRV3399B)** de Orange se reiniciaba solo:

- **`monitor.sh`** hace ping cada 2 s al router y a internet y registra los cambios. Si ambos caen unos 2 minutos, el router se está reiniciando; no es una caída de Orange.
- **Descartada la carga del Wi-Fi:** se apagó el Wi-Fi del Livebox y la red pasó a un mesh en modo AP. Siguió reiniciándose, incluso de madrugada.
- **Descartadas la fibra y la temperatura:** `livebox-fibra-optics-logger.js` registró cada minuto el módulo GPON (~47 °C, RX ≈ -19 dBm, TX ≈ +2,5 dBm). Todo estaba estable hasta el último minuto antes del fallo, lo que apunta a hardware o fuente de alimentación.
- **Peor episodio:** unos 30 reinicios entre las 15:52 y las 17:36.
- **Solución:** Orange envió un Livebox 7 (ZTE). El Wi-Fi del router está apagado y el mesh va por cable.

Consejos: mide router e internet por separado; mira el tiempo de actividad tras cada corte; un RX entre -8 y -27 dBm es normal; prueba otra fuente de 12 V; y en días de partido, los bloqueos de LaLiga pueden tumbar webs alojadas en Cloudflare.

## License

MIT
