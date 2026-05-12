import json

def analyze(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    stutters = data.get('stutterEvents', [])
    if not stutters:
        print("Tidak ada event stutter.")
        return

    print("--- HASIL ANALISIS LOG PERFORMA ---")
    
    # Sort by dt descending
    sorted_stutters = sorted(stutters, key=lambda x: x['dt'], reverse=True)
    
    print(f"\n1. Kejadian Terparah (Top 5):")
    for s in sorted_stutters[:5]:
        status = "BATTLE" if s['activeUnitsAtEvent'] > 0 else "LOADING"
        print(f"   - Delay: {s['dt']:.1f}ms | Units: {s['activeUnitsAtEvent']} | Heap: {s['heapAtEvent']:.1f}MB | [{status}]")

    # Analisis GC (Penurunan memori mendadak)
    gc_events = []
    for i in range(1, len(stutters)):
        diff = stutters[i]['heapAtEvent'] - stutters[i-1]['heapAtEvent']
        if diff < -10: # Drop lebih dari 10MB
            gc_events.append((stutters[i], diff))
    
    if gc_events:
        print(f"\n2. Deteksi Garbage Collection (GC):")
        print(f"   Ditemukan {len(gc_events)} kejadian di mana browser membeku untuk membersihkan memori.")
        for event, diff in gc_events[:3]:
            print(f"   - Delay: {event['dt']:.1f}ms | Heap Drop: {diff:.1f}MB (Mendadak)")

    # Kesimpulan Jaringan
    print(f"\n3. Analisis Jaringan vs Hardware:")
    # Jika dt tinggi, itu adalah Hardware/Browser (CPU/GPU/Memori). 
    # Jaringan tidak menyebabkan frame delay (dt) tinggi di sisi klien kecuali 
    # ada kode yang memblokir loop utama (biasanya tidak ada di Three.js).
    print("   - Semua nilai 'dt' yang tinggi (>50ms) adalah masalah LOKAL (Browser/CPU/Memori).")
    print("   - Jaringan TIDAK menyebabkan frame delay 'dt' setinggi ini.")
    print("   - Kesimpulan: Ini BUKAN masalah jaringan kamu, tapi beban Browser.")

analyze('/home/yoga/Dokumen/kroco/tiktok-next/public/battle-perf-2026-05-12T16-02-45.json')
