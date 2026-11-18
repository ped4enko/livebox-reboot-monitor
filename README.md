# Livebox Fibra keeps rebooting? Diagnose Orange Spain fiber drops (Livebox se reinicia solo)

**Free scripts that prove whether an [Orange Spain](https://www.orange.es/) Livebox router is rebooting by itself, or whether the fiber line or the operator is at fault.** They are a ping monitor that tells router and internet drops apart, an outage analyzer that counts reboots, and a GPON optics logger for the Livebox Fibra (Arcadyan PRV3399B).

> 🇪🇸 **¿Tu Livebox de Orange se reinicia solo y la fibra se corta varias veces al día?** [Ver la guía en español](#español-livebox-se-reinicia-solo-cortes-de-fibra-orange).

## Contents

- [Symptoms](#symptoms)
- [Real case: Livebox Fibra installed in 2020](#real-case-livebox-fibra-installed-in-2020)
- [How to diagnose: router reboot vs fiber vs operator](#how-to-diagnose-router-reboot-vs-fiber-vs-operator)
- [Tools and usage](#tools-and-usage)
- [FAQ](#faq)
- [Español: Livebox se reinicia solo, cortes de fibra Orange](#español-livebox-se-reinicia-solo-cortes-de-fibra-orange)

## Symptoms

- The internet drops for **2-5 minutes, several times a day**, often while Wi-Fi still shows as connected.
- Sometimes the drops come in a **loop**, every few minutes for an hour or more.
- The Livebox lights go off or blink. The **uptime** in the admin page has reset after a drop.
- Orange support suggests restarting the router, and nothing changes.

If this sounds familiar, the router itself may be rebooting. The scripts below let you prove it with dates and times, which makes getting a replacement from Orange much easier.

## Real case: Livebox Fibra installed in 2020

| | |
|---|---|
| Operator | [Orange Spain](https://www.orange.es/), FTTH fiber |
| Router | **Livebox Fibra, Arcadyan PRV3399B** (router and ONT in one box) |
| In service since | **2020**, about six years of 24/7 use |
| Network | ~16 devices: Blink cameras, smart plugs, sensors, phones, laptops; TP-Link Deco mesh |

After about six years of continuous operation, the Livebox started rebooting on its own. Ageing power supplies and capacitors are a classic cause of this in home routers, and the data below fits that.

### Timeline

| When | What happened |
|---|---|
| Day 1, ~18:10 | Spontaneous reboot, dozens of short drops in the hour before |
| Day 1, 19:13-19:45 | Reboot loop |
| Day 1, evening | Livebox Wi-Fi switched off, all devices moved to the Deco mesh |
| Day 2, 01:53-02:43 | Reboot loop at night with nobody using the network |
| Day 2, 15:52-17:36 | **About 30 reboots in under two hours**, one every 3-4 minutes |
| Day 2, ~18:00 | Orange replaced it with a **Livebox 7** (made by ZTE) |

## How to diagnose: router reboot vs fiber vs operator

### 1. Log the router and the internet separately (`monitor.sh`)

The script pings the router and a public IP every 2 seconds and writes only state changes. A router reboot has a clear signature:

```
15:52:44 router=DOWN internet=DOWN   <- the box disappears from the LAN
15:54:49 router=DOWN internet=ok     <- back after ~2 min
15:54:52 router=ok   internet=ok     <- (admin ping answers a few seconds later)
15:56:19 router=DOWN internet=DOWN   <- and again 3.5 min later
...
16:24:51 router=DOWN internet=DOWN
16:26:57 router=ok   internet=DOWN   <- router back, fiber still syncing
16:28:23 router=DOWN internet=DOWN   <- reboots again before internet returns
```

| What the log shows | What it means |
|---|---|
| Router **and** internet down ~2 min | **The router is rebooting** |
| Router up, internet down | Line or operator problem |
| Both down for a few seconds | Wi-Fi hiccup on your own device |

### 2. Rule out Wi-Fi load

With Wi-Fi on the Livebox completely off and every device on a mesh in access-point mode, the reboots continued, including at night. So it was not too many Wi-Fi clients.

### 3. Rule out the fiber and overheating (`livebox-fibra-optics-logger.js`)

The Livebox admin page exposes the GPON transceiver data. Logged every minute, every value stayed flat until the last minute before the next crash:

| Metric | Range over ~4 h | Last minute before crash | Normal range |
|---|---|---|---|
| Transceiver temperature | 47.0 - 47.7 °C | 47.7 °C | below ~70 °C |
| Supply voltage | 3.19 - 3.22 V | 3.19 V | ~3.3 V ± 5 % |
| Laser bias | 17.0 - 17.9 mA | 17.2 mA | stable |
| TX power | +2.2 ... +2.9 dBm | +2.6 dBm | +0.5 ... +5 dBm |
| RX power | -19.1 ... -18.8 dBm | -18.9 dBm | -8 ... -27 dBm |
| RAM used | 59 - 61 % | 59 % | stable |

There was no warning sign at all: the box just died. That points to the router's hardware or its power supply, not the line.

### Outcome

With dates and times in hand, Orange replaced the router with a **Livebox 7** without argument. Wi-Fi on the new box is off and the mesh is wired to it. Monitoring of the new router is ongoing.

## Tools and usage

### monitor.sh: router vs internet logger (macOS / Linux)

```bash
./monitor.sh                                   # gateway 192.168.1.1, log to ./outages.log
GATEWAY=192.168.0.1 INTERVAL=2 ./monitor.sh    # other gateway
nohup ./monitor.sh >/dev/null 2>&1 &           # in the background
```

Run it on a computer that stays awake. On a laptop that goes to sleep, check `pmset -g log` (macOS) before blaming the router. A wired machine is best: on Wi-Fi you will also log your own Wi-Fi hiccups, although `analyze.py` labels most of those as `BLIP` / `LOCAL`.

### analyze.py: count reboots and outages

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

### livebox-fibra-optics-logger.js: GPON optics logger (Livebox Fibra / Arcadyan PRV3399B only)

1. Log in to `http://192.168.1.1` yourself and keep the tab open.
2. Paste the file into the browser DevTools console.
3. Use `lbx.table(30)`, `lbx.csv()` and `lbx.stop()` later.

The logger only reads two data files with plain GET requests. It changes no settings and never handles your password. After a reboot the session is lost, so log in and paste the script again; stored samples are kept. Other Livebox models, including the Livebox 7, have a different admin page, so this script will not work there.

## FAQ

**Why does my Livebox restart by itself?**
The usual causes are a failing power supply, ageing hardware (especially in routers from 2019-2021 that have run 24/7 for years), overheating, or a firmware fault. If the optical values are stable and the drops are full reboots, the hardware or the power supply is the most likely culprit.

**How do I know whether it is the router or Orange's line?**
Ping the router and an internet IP at the same time. If the router itself stops answering for about 2 minutes, it rebooted. If the router answers but the internet does not, the problem is on the line or the operator side.

**What are normal optical values for Orange fiber (GPON)?**
RX between about -8 and -27 dBm, TX between about +0.5 and +5 dBm, with the transceiver temperature well below 70 °C. Values that are stable and inside these ranges mean the fiber is fine.

**How do I get Orange to replace the Livebox?**
Call support with specific dates, times and the number of reboots. A log showing "30 reboots between 15:52 and 17:36" turns a long troubleshooting call into a replacement.

**Can I try anything before the replacement arrives?**
Try another 12 V power supply of the same rating, keep the router ventilated, and switch off its Wi-Fi if you already have a mesh system.

**Some websites do not load but the rest of the internet works. Is it the router?**
In Spain, probably not. On football match days, court-ordered LaLiga blocks sometimes take down Cloudflare IP ranges, so some websites time out while everything else works.

---

## Español: Livebox se reinicia solo, cortes de fibra Orange

**Scripts gratuitos para demostrar si tu Livebox de [Orange](https://www.orange.es/) se reinicia solo, o si el problema está en la fibra o en el operador.**

### Síntomas

- La fibra se corta **2-5 minutos varias veces al día**.
- A veces los cortes vienen **en bucle**, cada pocos minutos durante una hora o más.
- El **tiempo de actividad** del Livebox vuelve a cero después de cada corte.
- El soporte de Orange solo te dice que reinicies el router.

### Caso real: Livebox Fibra instalado en 2020

- **Router:** Livebox Fibra Arcadyan PRV3399B (router y ONT en un solo equipo), **instalado en 2020**, unos seis años funcionando 24/7.
- **Primero el Wi-Fi:** se apagó el Wi-Fi del Livebox y toda la red pasó a un mesh en modo AP. Siguió reiniciándose, incluso de madrugada.
- **Después la fibra:** se registró cada minuto el módulo GPON (~47 °C, RX ≈ -19 dBm, TX ≈ +2,5 dBm). Todo estable hasta el último minuto antes del fallo, lo que apunta al hardware o a la fuente de alimentación.
- **Peor episodio:** unos 30 reinicios entre las 15:52 y las 17:36.
- **Solución:** Orange envió un Livebox 7 (ZTE). El Wi-Fi del router está apagado y el mesh va por cable.

### Cómo saber si es el router o la línea

| Qué ves en el registro | Qué significa |
|---|---|
| Router **e** internet caídos ~2 min | **El router se está reiniciando** |
| Router responde, internet no | Problema de línea u operador |
| Ambos caen unos segundos | Fallo del Wi-Fi de tu propio dispositivo |

### Preguntas frecuentes

**¿Por qué mi Livebox se reinicia solo?** Lo más habitual es una fuente de alimentación que falla o un equipo envejecido, sobre todo si lleva años encendido sin parar. Si los valores ópticos son estables, la línea está bien.

**¿Qué valores de fibra son normales?** RX entre -8 y -27 dBm, TX entre +0,5 y +5 dBm y temperatura del módulo muy por debajo de 70 °C.

**¿Cómo consigo que Orange me cambie el router?** Llama con fechas, horas y número de reinicios. Con un registro así, el cambio de equipo es mucho más rápido.

**¿Qué puedo probar mientras tanto?** Otra fuente de 12 V de la misma potencia, buena ventilación y apagar el Wi-Fi del Livebox si ya tienes un mesh.

**¿Algunas webs no cargan y el resto sí?** En días de partido, los bloqueos de LaLiga pueden tumbar webs alojadas en Cloudflare. No es tu router.

### Uso rápido

```bash
./monitor.sh                       # registra router e internet cada 2 s
python3 analyze.py outages.log     # cuenta reinicios y cortes
```

---

## How this was built / Cómo se hizo

The diagnosis, the scripts and this write-up were made together with **Claude Opus 5.5** (Anthropic) in Claude Code: reading the logs, finding where the Livebox exposes its GPON data, and turning that into reusable tools.

El diagnóstico, los scripts y esta guía se hicieron con **Claude Opus 5.5** (Anthropic) en Claude Code.

---

**Keywords:** Livebox se reinicia solo, Livebox Fibra reinicios, Orange fibra cortes, Livebox Arcadyan PRV3399B, Livebox 7, router Orange se apaga, fibra Orange se corta, GPON RX power, Orange Spain router reboot loop, internet drops Spain.

## License

MIT. Not affiliated with Orange. Orange and Livebox are trademarks of their respective owners.
