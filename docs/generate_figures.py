import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Configure global font and style
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial', 'Helvetica']

def create_fig_4_1():
    fig, ax = plt.subplots(figsize=(8.5, 4.2), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5.2)
    ax.axis('off')

    # Color palette
    c_client = '#2563eb'
    c_proxy = '#475569'
    c_backend = '#1e293b'
    c_db = '#059669'
    c_redis = '#dc2626'
    c_sandbox = '#d97706'

    # Client Box
    box_client = patches.FancyBboxPatch((1.5, 4.0), 7.0, 0.9, boxstyle="round,pad=0.08,rounding_size=0.15",
                                        facecolor=c_client, edgecolor='none')
    ax.add_patch(box_client)
    ax.text(5.0, 4.55, 'Web Browsers (Clients)', ha='center', va='center', color='white', fontsize=11, fontweight='bold')
    ax.text(5.0, 4.2, 'React 19 • Monaco Editor • Yjs CRDT • WebRTC Voice • Socket.IO Client', ha='center', va='center', color='#dbeafe', fontsize=8.5)

    # Arrow Down
    ax.annotate('', xy=(5.0, 3.35), xytext=(5.0, 4.0),
                arrowprops=dict(arrowstyle="->", color='#334155', lw=1.5))
    ax.text(5.15, 3.65, 'HTTPS (REST) / WSS (WebSockets)', va='center', fontsize=8, color='#475569', fontstyle='italic')

    # Backend Cluster
    box_backend = patches.FancyBboxPatch((1.5, 2.3), 7.0, 1.05, boxstyle="round,pad=0.08,rounding_size=0.15",
                                         facecolor=c_backend, edgecolor='none')
    ax.add_patch(box_backend)
    ax.text(5.0, 2.95, 'Collab Code Backend Cluster', ha='center', va='center', color='white', fontsize=11, fontweight='bold')
    ax.text(5.0, 2.6, 'Node.js 20+ • Express 5 • Socket.IO 4.8 • WebRTC Signaling • Zod Validation', ha='center', va='center', color='#cbd5e1', fontsize=8.5)

    # Downward arrows to storage & sandbox
    for x_arr in [2.5, 5.0, 7.5]:
        ax.annotate('', xy=(x_arr, 1.45), xytext=(x_arr, 2.3),
                    arrowprops=dict(arrowstyle="->", color='#334155', lw=1.5))

    # Box 1: MongoDB
    box_db = patches.FancyBboxPatch((1.0, 0.3), 2.5, 1.1, boxstyle="round,pad=0.08,rounding_size=0.15",
                                    facecolor='#ecfdf5', edgecolor=c_db, lw=1.5)
    ax.add_patch(box_db)
    ax.text(2.25, 0.95, 'MongoDB Atlas', ha='center', va='center', color=c_db, fontsize=10, fontweight='bold')
    ax.text(2.25, 0.6, 'Users, Rooms, Messages,\nProblems & Submissions', ha='center', va='center', color='#065f46', fontsize=7.5)

    # Box 2: Redis
    box_redis = patches.FancyBboxPatch((3.8, 0.3), 2.4, 1.1, boxstyle="round,pad=0.08,rounding_size=0.15",
                                      facecolor='#fef2f2', edgecolor=c_redis, lw=1.5)
    ax.add_patch(box_redis)
    ax.text(5.0, 0.95, 'Redis 7 Adapter', ha='center', va='center', color=c_redis, fontsize=10, fontweight='bold')
    ax.text(5.0, 0.6, 'Pub/Sub Cross-Pod Sync\n& Token Rate Limiting', ha='center', va='center', color='#991b1b', fontsize=7.5)

    # Box 3: Execution Sandbox
    box_box = patches.FancyBboxPatch((6.5, 0.3), 2.5, 1.1, boxstyle="round,pad=0.08,rounding_size=0.15",
                                     facecolor='#fffbeb', edgecolor=c_sandbox, lw=1.5)
    ax.add_patch(box_box)
    ax.text(7.75, 0.95, 'Execution Sandbox', ha='center', va='center', color=c_sandbox, fontsize=10, fontweight='bold')
    ax.text(7.75, 0.6, 'Isolated Piston Engine\n(256MB Cap, 10s Timeout)', ha='center', va='center', color='#92400e', fontsize=7.5)

    plt.tight_layout()
    plt.savefig('/tmp/fig_4_1_architecture.png', bbox_inches='tight')
    plt.close()

def create_fig_4_2():
    # Real-Time Collaborative Synchronization and WebRTC Flow
    fig, ax = plt.subplots(figsize=(8.5, 3.2), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 3.5)
    ax.axis('off')

    steps = [
        ('1. User Input', 'Keystroke / Voice\nDictation / Audio', '#1e40af'),
        ('2. Local State', 'Monaco Change\nYjs CRDT Update', '#1e40af'),
        ('3. Binary Wire', 'Socket.IO Frame\nUint8Array Delta', '#1e40af'),
        ('4. Gateway', 'Express Cluster\nRedis Pub/Sub', '#0f766e'),
        ('5. Peer Ingestion', 'Remote Monaco\nConflict-Free Merge', '#047857'),
        ('6. Live Audio', 'Direct P2P Mesh\nEncrypted SRTP', '#b45309')
    ]

    for idx, (title, desc, col) in enumerate(steps):
        x = 0.5 + idx * 1.55
        box = patches.FancyBboxPatch((x, 1.0), 1.35, 1.5, boxstyle="round,pad=0.06,rounding_size=0.12",
                                     facecolor=col, edgecolor='none')
        ax.add_patch(box)
        ax.text(x + 0.675, 2.15, title, ha='center', va='center', color='white', fontsize=8.5, fontweight='bold')
        ax.text(x + 0.675, 1.5, desc, ha='center', va='center', color='#f1f5f9', fontsize=7.2)

        if idx < len(steps) - 1:
            ax.annotate('', xy=(x + 1.52, 1.75), xytext=(x + 1.35, 1.75),
                        arrowprops=dict(arrowstyle="->", color='#475569', lw=1.4))

    plt.tight_layout()
    plt.savefig('/tmp/fig_4_2_sync_flow.png', bbox_inches='tight')
    plt.close()

def create_fig_4_3():
    # Sandboxed Execution & Security Isolation Boundary
    fig, ax = plt.subplots(figsize=(8.5, 3.5), dpi=300)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4.0)
    ax.axis('off')

    # Host API Box
    box_host = patches.FancyBboxPatch((0.5, 1.2), 3.2, 2.2, boxstyle="round,pad=0.08,rounding_size=0.12",
                                     facecolor='#1e293b', edgecolor='none')
    ax.add_patch(box_host)
    ax.text(2.1, 3.0, 'Host API Server', ha='center', va='center', color='white', fontsize=10, fontweight='bold')
    ax.text(2.1, 2.4, '• JWT Token Verification\n• Zod Schema Validation\n• Rate Limit Check (Redis)\n• Ephemeral Request Dispatch',
            ha='center', va='center', color='#cbd5e1', fontsize=7.8)

    # Isolation Boundary Gap (Vertical Dashed Lines)
    ax.axvline(x=4.8, ymin=0.1, ymax=0.9, color='#dc2626', linestyle='--', lw=2.0)
    ax.axvline(x=5.2, ymin=0.1, ymax=0.9, color='#dc2626', linestyle='--', lw=2.0)
    ax.text(5.0, 3.6, 'SECURITY ISOLATION BOUNDARY', ha='center', va='center', color='#dc2626', fontsize=8, fontweight='bold')
    ax.text(5.0, 0.4, '(Network Gap & Resource Ceilings)', ha='center', va='center', color='#dc2626', fontsize=7, fontstyle='italic')

    # Sandboxed Runner Box
    box_box = patches.FancyBboxPatch((6.3, 1.2), 3.2, 2.2, boxstyle="round,pad=0.08,rounding_size=0.12",
                                     facecolor='#0f172a', edgecolor='#f59e0b', lw=1.5)
    ax.add_patch(box_box)
    ax.text(7.9, 3.0, 'Isolated Runner Pod', ha='center', va='center', color='#f59e0b', fontsize=10, fontweight='bold')
    ax.text(7.9, 2.4, '• Non-Root Linux User Space\n• 256MB Hard Memory Ceiling\n• 10s CPU Wall-Clock Timeout\n• Read-Only Root Filesystem',
            ha='center', va='center', color='#f8fafc', fontsize=7.8)

    # Arrows crossing boundary
    ax.annotate('', xy=(6.2, 2.5), xytext=(3.8, 2.5),
                arrowprops=dict(arrowstyle="->", color='#2563eb', lw=1.5))
    ax.text(5.0, 2.7, 'JSON Payload', ha='center', va='bottom', fontsize=7.5, color='#1e40af')

    ax.annotate('', xy=(3.8, 1.8), xytext=(6.2, 1.8),
                arrowprops=dict(arrowstyle="->", color='#059669', lw=1.5))
    ax.text(5.0, 1.55, 'STDOUT / STDERR', ha='center', va='top', fontsize=7.5, color='#047857')

    plt.tight_layout()
    plt.savefig('/tmp/fig_4_3_sandbox_isolation.png', bbox_inches='tight')
    plt.close()

def create_fig_5_interface():
    # 4-card interface grid representing actual UI modules
    fig, axes = plt.subplots(2, 2, figsize=(8.5, 5.0), dpi=300)

    # Card 1: Collaborative Monaco Editor
    ax = axes[0, 0]
    ax.set_facecolor('#1e1e1e')
    ax.set_title('Figure 5.1: Real-Time Monaco Editor & Remote Cursors', fontsize=8.5, pad=6, fontweight='bold')
    ax.text(0.05, 0.85, 'function twoSum(nums, target) {', color='#9cdcfe', fontfamily='monospace', fontsize=7.5)
    ax.text(0.12, 0.70, 'const map = new Map();', color='#dcdcaa', fontfamily='monospace', fontsize=7.5)
    ax.text(0.12, 0.55, 'for (let i = 0; i < nums.length; i++) {', color='#ce9178', fontfamily='monospace', fontsize=7.5)
    ax.text(0.19, 0.40, 'const diff = target - nums[i];', color='#4ec9b0', fontfamily='monospace', fontsize=7.5)
    ax.text(0.19, 0.25, 'if (map.has(diff)) return [map.get(diff), i];', color='#9cdcfe', fontfamily='monospace', fontsize=7.5)
    ax.text(0.12, 0.10, '} map.set(nums[i], i); }', color='#dcdcaa', fontfamily='monospace', fontsize=7.5)
    # Cursor tag
    ax.plot([0.52, 0.52], [0.38, 0.44], color='#38bdf8', lw=2)
    ax.text(0.53, 0.46, 'Abhishek (Ln 4, Col 28)', color='#38bdf8', fontsize=6.5, fontweight='bold')
    ax.axis('off')

    # Card 2: Code Execution Output
    ax = axes[0, 1]
    ax.set_facecolor('#0f172a')
    ax.set_title('Figure 5.2: Multi-Language Sandboxed Execution Output', fontsize=8.5, pad=6, fontweight='bold')
    ax.text(0.05, 0.85, '>>> STATUS: SUCCESS (Exit Code 0)', color='#4ade80', fontfamily='monospace', fontsize=7.5, fontweight='bold')
    ax.text(0.05, 0.70, 'Language: TypeScript 5.7 (Isolated Runtime)', color='#cbd5e1', fontfamily='monospace', fontsize=7.2)
    ax.text(0.05, 0.55, 'Execution Time: 0.142s | Memory: 18.4 MB', color='#cbd5e1', fontfamily='monospace', fontsize=7.2)
    ax.text(0.05, 0.38, '--- STDOUT ---', color='#94a3b8', fontfamily='monospace', fontsize=7.0)
    ax.text(0.05, 0.24, 'Test Case 1 Passed: [0, 1] == [0, 1]', color='#f8fafc', fontfamily='monospace', fontsize=7.2)
    ax.text(0.05, 0.10, 'Test Case 2 Passed: [1, 2] == [1, 2]', color='#f8fafc', fontfamily='monospace', fontsize=7.2)
    ax.axis('off')

    # Card 3: WebRTC Voice & Audio Lounge
    ax = axes[1, 0]
    ax.set_facecolor('#18181b')
    ax.set_title('Figure 5.3: WebRTC Mesh Voice Channel & Audio Hub', fontsize=8.5, pad=6, fontweight='bold')
    ax.text(0.05, 0.82, 'Voice Room: Active (3 Peers Connected)', color='#38bdf8', fontsize=7.5, fontweight='bold')
    ax.text(0.05, 0.65, '• Abhishek Gangwar (Host) - Speaking [===|===]', color='#22c55e', fontfamily='monospace', fontsize=7.2)
    ax.text(0.05, 0.50, '• Collaborator_02 - Muted [Hardware Off]', color='#94a3b8', fontfamily='monospace', fontsize=7.2)
    ax.text(0.05, 0.35, '• Collaborator_03 - Listening', color='#94a3b8', fontfamily='monospace', fontsize=7.2)
    ax.text(0.05, 0.15, 'Voice Note: 00:14 / 00:45 [▶ |||||||||||||||||||||||]', color='#fbbf24', fontfamily='monospace', fontsize=7.2)
    ax.axis('off')

    # Card 4: Algorithmic Challenge Practice
    ax = axes[1, 1]
    ax.set_facecolor('#111827')
    ax.set_title('Figure 5.4: Algorithmic Practice Catalog & Custom Problems', fontsize=8.5, pad=6, fontweight='bold')
    ax.text(0.05, 0.85, 'Problem 1: Two Sum [Easy] ✓ Solved', color='#10b981', fontsize=7.5, fontweight='bold')
    ax.text(0.05, 0.68, 'Problem 2: Valid Parentheses [Easy] ✓ Solved', color='#10b981', fontsize=7.5, fontweight='bold')
    ax.text(0.05, 0.51, 'Problem 3: Reverse Linked List [Medium] - Active', color='#f59e0b', fontsize=7.5, fontweight='bold')
    ax.text(0.05, 0.34, 'Problem 4: Maximum Subarray [Medium]', color='#9ca3af', fontsize=7.5)
    ax.text(0.05, 0.15, '+ Custom Challenge Created: "Merge K Sorted Intervals"', color='#60a5fa', fontsize=7.2, fontstyle='italic')
    ax.axis('off')

    plt.tight_layout()
    plt.savefig('/tmp/fig_5_interface.png', bbox_inches='tight')
    plt.close()

if __name__ == '__main__':
    create_fig_4_1()
    create_fig_4_2()
    create_fig_4_3()
    create_fig_5_interface()
    print('All 4 report figures generated successfully!')
