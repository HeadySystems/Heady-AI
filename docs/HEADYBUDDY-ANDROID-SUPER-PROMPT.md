# HEADYBUDDY ANDROID — SUPER PROMPT v1.0

> **Codename:** Pocket Lattice  
> **Version:** 1.0.0 | **Generated:** 2026-03-15 | **Heady Runtime:** v3.1.0  
> **Scope:** Full-stack autonomous Android AI companion — Work Profile + AppFunctions + Cloud  
> **Target:** Android 10–16, Kotlin/Compose, Cloudflare → Cloud Run → Qdrant + Neon + Redis  
> © 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents  
> Proprietary and Confidential

---

## HOW TO USE THIS DOCUMENT

Paste **Part I (The Super Prompt)** verbatim into any AI coding agent (Cursor, Windsurf, Claude, Copilot, Antigravity) as the system instruction for building HeadyBuddy Android.

**Part II** is the step-by-step implementation guide with production Kotlin code.

**Part III** is the 4-layer bulletproof testing system that guarantees zero regressions reach users.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART I — THE SUPER PROMPT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```text
SYSTEM: HEADYBUDDY ANDROID — MAXIMUM POTENTIAL BUILD AGENT

You are a full-stack autonomous mobile systems architect building HeadyBuddy for Android.
HeadyBuddy is the on-device AI companion layer of the HeadySystems platform. Your objective
is to build, wire, verify, and deliver a production-grade Android application with ZERO
placeholders, ZERO stubs, and ZERO localhost references.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTITY & MISSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HeadyBuddy is:
- A persistent AI companion living inside an Android Work Profile as Profile Owner
- Connected at all times to HeadySystems cloud at api.headysystems.com via WSS
- A user-authorized agent that acts on behalf of the user across approved apps only
- Memory-first: every action, conversation, outcome stored in the user's personal
  persistent latent space (CSL-gated 384-dim vectors, φ=0.618 threshold)
- Cross-device: state is fully cloud-synced — new phone restores everything automatically
- Platform-blessed: AppFunctions (Android 16) + isAccessibilityTool=true, Play Store safe
- Privacy-by-default: kernel-isolated in Work Profile; cannot access personal profile data
  unless user explicitly grants cross-profile access per-app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCHITECTURE: THREE LAYERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LAYER 1 — WORK PROFILE (Buddy's Domain)
  Package: com.headysystems.buddy.work
  Role: Profile Owner — full authority over the work zone
  Components:
    - HeadyBuddyAdminReceiver ← DeviceAdminReceiver subclass
    - HeadyAppFunctionCaller  ← AppFunctionManager wrapper
    - HeadyUIAutomationService ← AccessibilityService (isAccessibilityTool=true)
    - HeadyWorkProfileManager  ← app install/freeze/unfreeze/permission map
    - HeadyCloudBridge          ← WSS to api.headysystems.com/v1/buddy
    - HeadyMemoryClient         ← CSL bootstrap + memory read/write
    - HeadyTaskExecutor         ← receives tasks from cloud, routes to AppFunctions or UI

LAYER 2 — PERSONAL PROFILE COMPANION (User's Window into Buddy)
  Package: com.headysystems.buddy
  Role: Thin control plane only — never executes tasks directly
  Components:
    - HeadyPermissionPanel   ← which apps can Buddy use — per-app toggles
    - HeadyLiveMonitor       ← what Buddy is doing right now — persistent notification
    - HeadyMemoryWidget      ← home screen widget: memory count, CSL score, active tasks
    - HeadyEmergencyStop     ← volume-down triple-press → STOP_ALL_TASKS broadcast
    - HeadyOnboardingFlow    ← work profile provisioning + first-run wizard

LAYER 3 — CLOUD LAYER (HeadySystems)
  Production URLs only, zero localhost:
    api.headysystems.com/v1/buddy           — WSS task stream
    api.headysystems.com/v1/memory          — CSL memory CRUD
    api.headysystems.com/v1/memory/bootstrap — top-21 vector bootstrap
    api.headysystems.com/v1/auth/me         — token verification
    api.headysystems.com/v1/tasks           — task queue
  Cloud: HeadyConductor → HeadyBrain → HeadyMemory → HeadyPatterns

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10 NON-NEGOTIABLE IMPLEMENTATION REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PROFILE OWNER PROVISIONING
   - Intent("android.app.action.PROVISION_MANAGED_PROFILE") for user-provisioned setup
   - onProfileProvisioningComplete() must: set profile name, register device with cloud,
     bootstrap memory, install approved apps from user's workApps[]
   - NEVER request Device Owner — Profile Owner only, user-consented

2. APP PERMISSION MAP
   - Stored in HeadyMemory: { appPackage, accessLevel, grantedAt }
   - Levels: "read_only" | "full_access" | "revoked"
   - Sync bidirectional: local Room DB ↔ api.headysystems.com/v1/memory/app-permissions
   - Before EVERY task: check permission map → if app not in map or revoked → ABORT,
     notify user via notification, never silently skip

3. APP FUNCTION EXECUTION (Android 16 primary path)
   - AppFunctionManager.executeAppFunction()
   - EXECUTE_APP_FUNCTIONS permission (auto-granted to Profile Owner)
   - HeadyAppFunctionRegistry caches discovered functions per-package
   - On failure: 3-retry exponential backoff → fallback to UI automation
   - All executions logged to HeadyMemory with full telemetry

4. UI AUTOMATION SERVICE (FALLBACK)
   - AccessibilityService with isAccessibilityTool="true"
   - canPerformGestures="true", canRetrieveWindowContent="true"
   - Only for apps with full_access in permission map
   - Hard timeout: 30s per action, max 7 chained actions before user checkpoint

5. CROSS-PROFILE COMMUNICATION
   - CrossProfileApps API for all personal↔work communication
   - INTERACT_ACROSS_PROFILES requested during onboarding (user-consented)
   - Work→Personal: system surfaces notifications automatically
   - Personal→Work: CrossProfileApps.startMainActivity() or cross-profile intents

6. CLOUD SYNC — WEBSOCKET
   - wss://api.headysystems.com/v1/buddy/ws
   - Auth: Bearer token + Ed25519 device signature in headers
   - Heartbeat: ping 30s, pong timeout 10s, reconnect on failure
   - Protocol: JSON { type, taskId, payload }
   - All messages persisted to Room DB before processing (write-ahead log)

7. MEMORY BOOTSTRAP ON EVERY SESSION
   - POST api.headysystems.com/v1/memory/bootstrap on work profile unlock
   - Payload: { userId, siteId: "headybuddy-android", cslThreshold: 0.618, topK: 21, dims: 384 }
   - Response stored encrypted in Room DB (Android Keystore encryption)
   - Injected into every LLM call via buildSystemContext()

8. CROSS-DEVICE RESTORE
   - On first boot: check api.headysystems.com/v1/devices/profile
   - Restore workApps[], permissionMap[], userPreferences
   - Re-provision work profile automatically from stored config

9. EMERGENCY STOP
   - Triple-press volume-down within 1.5s → STOP_ALL_TASKS
   - Notification action "Stop Buddy" → same signal
   - Must: cancel all tasks, disconnect WSS, update cloud status
   - After stop: require explicit "Resume Buddy" from permission panel

10. SECURITY
    - TLS 1.3 minimum, cert pinning for api.headysystems.com
    - Tokens: Android Keystore only, never SharedPreferences
    - Permission map: encrypted with Argon2id user-derived key
    - Memory vectors: encrypted at rest, decrypted only in-process
    - Work profile data isolation: kernel-enforced by Android

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPEN-SOURCE EXTRACTIONS TO INTEGRATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OpenClaw Mission Control — FrameworkAdapter pattern
   → HeadyFrameworkAdapter.kt: register, heartbeat, reportTask, getAssignments, disconnect

2. OpenClaw Mission Control — 4-Layer Eval Engine
   → HeadyEvalEngine.kt: task completion, loop detection, tool reliability, drift detection

3. OpenClaw Mission Control — Skill Sync Engine
   → HeadySkillManager: scan device skills, SHA-256 content hash, bidirectional sync

4. OpenClaw Office — Digital Twin Visualization
   → HeadyOfficeLiveView: animated Canvas showing Buddy's current activity

5. Ed25519 Device Identity
   → HeadyDeviceIdentity.kt: Android Keystore Ed25519, nonce signing for WSS handshake

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPEN-ENDED STRETCH GOALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Proactive suggestions: detect patterns, offer automation before asked
- Context-aware shortcuts: dynamic notification buttons based on app usage
- Cross-app workflows: "book me a ride to dinner at 7" → Calendar + Uber
- Voice trigger: "Hey Buddy" via VoiceInteractionService + SpeechRecognizer
- Weekly digest: what Buddy did, time/money saved, patterns discovered
- App freezing: Profile Owner setApplicationEnabled for focus mode

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY BAR — NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Zero localhost or 127.0.0.1 anywhere in codebase
- Zero hardcoded credentials — all from Android Keystore or BuildConfig
- Zero unhandled exceptions — all coroutines use CoroutineExceptionHandler
- Zero ANRs — all network/DB/file ops on IO dispatcher
- All Kotlin, minSdk 29 (Android 10), targetSdk 36 (Android 16)
- All Compose UI — no XML layouts
- All async with Kotlin Coroutines + Flow — no callbacks, no RxJava
- Comprehensive test coverage (see Testing System)
- All permissions declared with rationale strings
- App passes Android App Bundle review without policy violations
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART II — STEP-BY-STEP IMPLEMENTATION GUIDE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Step 1: Project Structure

```text
headybuddy-mobile/
├── app-companion/              # Personal profile companion APK
│   └── src/main/
│       ├── kotlin/.../buddy/
│       │   ├── ui/             # PermissionPanel, LiveMonitor, Widget
│       │   ├── crossprofile/   # CrossProfileApps bridge
│       │   └── onboarding/     # Work profile provisioning wizard
│       └── AndroidManifest.xml
├── app-work/                   # Work profile APK (the real Buddy)
│   └── src/main/
│       ├── kotlin/.../buddy/work/
│       │   ├── admin/          # HeadyBuddyAdminReceiver
│       │   ├── appfunctions/   # AppFunctionCaller + Registry
│       │   ├── automation/     # AccessibilityService
│       │   ├── cloud/          # WSS client + CloudBridge
│       │   ├── memory/         # CSL memory client + Room DB
│       │   ├── tasks/          # TaskExecutor + routing
│       │   └── skills/         # Skill sync engine
│       └── AndroidManifest.xml
├── core/                       # Shared module
│   └── src/main/kotlin/.../
│       ├── models/             # Task, Memory, PermissionMap, DeviceProfile
│       ├── security/           # HeadyDeviceIdentity, Keystore utils
│       └── eval/               # HeadyEvalEngine (4-layer)
├── testing/                    # Shared test utilities, mock servers
├── settings.gradle.kts
└── build.gradle.kts
```

## Step 2: Manifest Configuration

### app-work/AndroidManifest.xml

```xml
<manifest package="com.headysystems.buddy.work">

  <!-- Profile Owner admin receiver -->
  <receiver
    android:name=".admin.HeadyBuddyAdminReceiver"
    android:permission="android.permission.BIND_DEVICE_ADMIN"
    android:exported="true">
    <meta-data android:name="android.app.device_admin"
               android:resource="@xml/heady_device_admin"/>
    <intent-filter>
      <action android:name="android.app.action.DEVICE_ADMIN_ENABLED"/>
      <action android:name="android.app.action.PROFILE_PROVISIONING_COMPLETE"/>
    </intent-filter>
  </receiver>

  <!-- UI Automation service (accessibility) -->
  <service
    android:name=".automation.HeadyUIAutomationService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="false">
    <intent-filter>
      <action android:name="android.accessibilityservice.AccessibilityService"/>
    </intent-filter>
    <meta-data android:name="android.accessibilityservice"
               android:resource="@xml/heady_automation_config"/>
  </service>

  <uses-permission android:name="android.permission.EXECUTE_APP_FUNCTIONS"/>
  <uses-permission android:name="android.permission.INTERACT_ACROSS_PROFILES"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"/>
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
  <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
</manifest>
```

### res/xml/heady_automation_config.xml

```xml
<accessibility-service
  android:accessibilityFeedbackType="feedbackGeneric"
  android:accessibilityFlags="flagDefault|flagReportViewIds|flagRequestEnhancedWebAccessibility"
  android:canPerformGestures="true"
  android:canRetrieveWindowContent="true"
  android:isAccessibilityTool="true"
  android:settingsActivity=".ui.AutomationSettingsActivity"
  android:description="@string/heady_automation_description"
  android:notificationTimeout="100"/>
```

## Step 3: Work Profile Provisioning

```kotlin
// HeadyBuddyAdminReceiver.kt — Profile Owner receiver
class HeadyBuddyAdminReceiver : DeviceAdminReceiver() {
    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
        val admin = getWho(context)

        // 1. Name the work profile
        dpm.setProfileName(admin, "HeadyBuddy Work Zone")

        // 2. Enable cross-profile intents for camera
        dpm.addCrossProfileIntentFilter(admin,
            IntentFilter(MediaStore.ACTION_IMAGE_CAPTURE),
            DevicePolicyManager.FLAG_MANAGED_CAN_ACCESS_PARENT)

        // 3. Bootstrap in background
        CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
            HeadyCloudBridge.getInstance(context).registerDevice()
            HeadyMemoryClient.getInstance(context).bootstrap()
            HeadyWorkProfileManager.getInstance(context).installDefaultApps()
        }
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        context.startForegroundService(
            Intent(context, HeadyBuddyForegroundService::class.java))
    }
}
```

```kotlin
// HeadyOnboardingViewModel.kt — Personal profile provisioning trigger
class HeadyOnboardingViewModel(
    private val context: Context,
    private val cloudApi: HeadyCloudApi
) : ViewModel() {
    fun startWorkProfileProvisioning() {
        val dpm = context.getSystemService(DevicePolicyManager::class.java)
        if (dpm.isProfileOwnerApp(context.packageName)) {
            viewModelScope.launch { bootstrapExistingProfile() }
            return
        }
        val intent = Intent("android.app.action.PROVISION_MANAGED_PROFILE").apply {
            putExtra(DevicePolicyManager.EXTRA_PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME,
                ComponentName("com.headysystems.buddy.work",
                    "com.headysystems.buddy.work.admin.HeadyBuddyAdminReceiver"))
            putExtra(DevicePolicyManager.EXTRA_PROVISIONING_SKIP_ENCRYPTION, false)
        }
        context.startActivity(intent)
    }

    private suspend fun bootstrapExistingProfile() {
        val token = HeadyKeystore.getAuthToken()
        val profile = cloudApi.getDeviceProfile(token)
        profile.workApps.forEach { HeadyWorkProfileManager.ensureInstalled(it) }
    }
}
```

## Step 4: AppFunction Execution Engine

```kotlin
// HeadyAppFunctionCaller.kt — Primary task execution path
@RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
class HeadyAppFunctionCaller(
    private val context: Context,
    private val memoryClient: HeadyMemoryClient,
    private val permissionMap: HeadyPermissionMap
) {
    private val afm = context.getSystemService(AppFunctionManager::class.java)
    private val registry = HeadyAppFunctionRegistry(context)
    private val executor = Executors.newFixedThreadPool(4)

    suspend fun execute(
        appPackage: String, functionId: String,
        params: Bundle, taskId: String
    ): AppFunctionResult {
        // 1. Permission gate — NEVER skip
        val perm = permissionMap.getPermission(appPackage)
        if (perm == null || perm.accessLevel == AccessLevel.REVOKED)
            return AppFunctionResult.PermissionDenied(appPackage, taskId)

        // 2. Function discovery
        if (registry.getFunctions(appPackage).none { it.id == functionId })
            return AppFunctionResult.FunctionNotFound(appPackage, functionId)

        // 3. Execute with 3-retry exponential backoff
        val startMs = System.currentTimeMillis()
        return withRetry(maxAttempts = 3, backoffMs = 1000L) {
            suspendCoroutine { cont ->
                val req = ExecuteAppFunctionRequest.Builder(appPackage, functionId, params).build()
                afm.executeAppFunction(req, executor) { response ->
                    val dur = System.currentTimeMillis() - startMs
                    if (response.isSuccess) {
                        memoryClient.logTaskSuccess(taskId, appPackage, functionId, dur)
                        cont.resume(AppFunctionResult.Success(response.result, dur))
                    } else {
                        cont.resume(AppFunctionResult.Failed(response.errorMessage, dur))
                    }
                }
            }
        }
    }
}
```

## Step 5: Cloud WebSocket Bridge

```kotlin
// HeadyCloudBridge.kt — WSS connection with Ed25519 device auth
class HeadyCloudBridge(
    private val context: Context,
    private val deviceIdentity: HeadyDeviceIdentity,
    private val taskExecutor: HeadyTaskExecutor,
    private val memoryClient: HeadyMemoryClient
) {
    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .certificatePinner(CertificatePinner.Builder()
            .add("api.headysystems.com", "sha256/CERT_PIN_HASH")
            .build())
        .build()

    private var ws: WebSocket? = null
    private val _state = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _state

    fun connect() {
        val token = HeadyKeystore.getAuthToken() ?: return
        val nonce = UUID.randomUUID().toString()
        val sig = deviceIdentity.signNonce(nonce)

        val request = Request.Builder()
            .url("wss://api.headysystems.com/v1/buddy/ws")
            .addHeader("Authorization", "Bearer $token")
            .addHeader("X-Device-Id", deviceIdentity.deviceId)
            .addHeader("X-Device-Nonce", nonce)
            .addHeader("X-Device-Signature", sig)
            .build()

        ws = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                _state.value = ConnectionState.CONNECTED
            }
            override fun onMessage(ws: WebSocket, text: String) {
                CoroutineScope(Dispatchers.IO).launch {
                    val msg = Json.decodeFromString<HeadyMessage>(text)
                    HeadyTaskDb.persist(msg) // Write-ahead log
                    when (msg.type) {
                        "task" -> taskExecutor.enqueue(msg.toTask())
                        "memory_update" -> memoryClient.applyRemoteUpdate(msg.payload)
                        "ack" -> HeadyTaskDb.markAcked(msg.taskId)
                    }
                }
            }
            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                _state.value = ConnectionState.DISCONNECTED
                HeadyReconnectWorker.schedule(context)
            }
        })
    }
}
```

## Step 6: Memory Bootstrap & CSL Injection

```kotlin
// HeadyMemoryClient.kt — CSL-gated memory with Keystore encryption
class HeadyMemoryClient(
    private val context: Context,
    private val api: HeadyCloudApi,
    private val db: HeadyMemoryDatabase
) {
    private var profile: MemoryBootstrapResponse? = null

    suspend fun bootstrap(): MemoryBootstrapResponse {
        val token = HeadyKeystore.getAuthToken() ?: throw SecurityException("No token")
        val resp = api.bootstrapMemory(token, MemoryBootstrapRequest(
            userId = HeadyKeystore.getUserId()!!,
            siteId = "headybuddy-android",
            cslThreshold = 0.618f, topK = 21, dims = 384
        ))
        db.memoryDao().upsertAll(resp.contextMemories.map { it.toEntity() })
        profile = resp
        HeadyWorkProfileManager.getInstance(context).syncWorkApps(resp.workApps)
        return resp
    }

    fun buildSystemContext(): String {
        val p = profile ?: return ""
        return buildString {
            appendLine("# User Memory (CSL: ${p.cslScore})")
            appendLine("Vectors active: ${p.memoryCount}")
            p.contextMemories.take(21).forEach { m ->
                appendLine("- [${m.type}] ${m.content} (${m.score})")
            }
        }
    }

    suspend fun logTaskSuccess(taskId: String, app: String, fn: String, ms: Long) {
        val entry = MemoryEntry("task_execution",
            "Executed $fn on $app in ${ms}ms", taskId,
            System.currentTimeMillis(), profile?.cslScore ?: 0f)
        db.memoryDao().insert(entry.toEntity())
        api.addMemory(HeadyKeystore.getAuthToken()!!, entry)
    }
}
```

## Step 7: Permission Panel UI (Compose)

```kotlin
@Composable
fun HeadyPermissionPanel(vm: PermissionPanelViewModel = hiltViewModel()) {
    val apps by vm.workApps.collectAsStateWithLifecycle()
    val csl by vm.cslScore.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize().background(Color(0xFF0D0D1A)).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("🤖 HeadyBuddy — App Access",
                style = MaterialTheme.typography.headlineSmall,
                color = Color(0xFFE8E8F0))
            Spacer(Modifier.weight(1f))
            Text("CSL ${csl.format(3)}", color = Color(0xFF00D4AA),
                style = MaterialTheme.typography.labelSmall)
        }
        Spacer(Modifier.height(8.dp))
        Text("Choose which apps Buddy can interact with.",
            color = Color(0xFF9898B0), style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(16.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(apps, key = { it.packageName }) { app ->
                AppPermissionRow(app) { vm.setAccessLevel(app.packageName, it) }
            }
            item {
                OutlinedButton(onClick = { vm.showAddAppSheet() },
                    Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = Color(0xFF00D4AA)),
                    border = BorderStroke(1.dp, Color(0xFF00D4AA).copy(alpha=0.5f))
                ) {
                    Icon(Icons.Default.Add, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Add App to Work Zone")
                }
            }
        }
    }
}
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART III — BULLETPROOF TESTING SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Testing Architecture

```
┌───────────────────────────────────────────────────┐
│  PRE-COMMIT GATES (<30s locally)                  │
│  ├── Static: Detekt + ktlint                      │
│  ├── Unit: JVM (no Android runtime)               │
│  └── Lint: Android Lint + HeadyLint custom rules  │
├───────────────────────────────────────────────────┤
│  CI GATES — PR REQUIRED (every PR)                │
│  ├── Layer 1: Unit + Integration tests            │
│  ├── Layer 2: Instrumented on emulator            │
│  ├── Layer 3: Work Profile E2E on Firebase TL     │
│  └── Layer 4: Heady Eval Engine (drift check)     │
├───────────────────────────────────────────────────┤
│  CANARY RELEASE (5% users, 48h soak)              │
│  ├── Crash rate < 0.1%                            │
│  ├── Task success ≥ 98%                           │
│  ├── Memory bootstrap < 2s P99                    │
│  └── WSS uptime ≥ 99.5%                          │
└───────────────────────────────────────────────────┘
```

## Layer 1: Unit Tests (JVM, No Android)

```kotlin
class HeadyAppFunctionCallerTest {
    private val mockPerms = mockk<HeadyPermissionMap>()
    private val mockMemory = mockk<HeadyMemoryClient>(relaxed = true)
    private lateinit var caller: HeadyAppFunctionCaller

    @Test
    fun `execute returns PermissionDenied when app not in map`() = runTest {
        every { mockPerms.getPermission("com.x") } returns null
        val r = caller.execute("com.x", "fn", Bundle(), "t-1")
        assertIs<AppFunctionResult.PermissionDenied>(r)
    }

    @Test
    fun `execute returns PermissionDenied when REVOKED`() = runTest {
        every { mockPerms.getPermission("com.x") } returns
            AppPermission("com.x", AccessLevel.REVOKED, 0L)
        assertIs<AppFunctionResult.PermissionDenied>(
            caller.execute("com.x", "fn", Bundle(), "t-1"))
    }

    @Test
    fun `execute retries 3x then returns Failed`() = runTest {
        // Mock 3 consecutive failures, verify retry count
    }

    @Test
    fun `execute logs to memory on success`() = runTest {
        // Verify memoryClient.logTaskSuccess called
    }
}

class HeadyMemoryClientTest {
    @Test
    fun `buildSystemContext empty when no bootstrap`() {
        val c = HeadyMemoryClient(mockk(), mockk(), mockk())
        assertEquals("", c.buildSystemContext())
    }

    @Test
    fun `buildSystemContext caps at 21 memories`() = runTest {
        // Bootstrap with 50, assert only 21 in output
    }

    @Test
    fun `bootstrap persists all memories to Room`() = runTest {
        // Assert upsertAll called with correct entities
    }
}
```

## Layer 2: Instrumented Tests (Emulator)

```kotlin
@RunWith(AndroidJUnit4::class)
@LargeTest
class HeadyCloudBridgeInstrumentedTest {
    private val mockServer = MockWebServer()

    @Test
    fun connectSendsCorrectHeaders() {
        // Verify Authorization, X-Device-Id, X-Device-Signature headers
    }

    @Test
    fun incomingTaskPersistedBeforeExecution() {
        // Write-ahead log: Room DB entry exists before TaskExecutor called
    }

    @Test
    fun connectionReconnectsAfterFailure() {
        // Verify WorkManager schedules HeadyReconnectWorker
    }
}

@RunWith(AndroidJUnit4::class)
class HeadyPermissionMapInstrumentedTest {
    @Test
    fun permissionsPersistedAcrossProcessRestart() {}

    @Test
    fun permissionsSyncToCloudAfterChange() {}

    @Test
    fun dbEncryptedWithAndroidKeystore() {}
}
```

## Layer 3: Work Profile E2E (Firebase Test Lab)

```kotlin
@RunWith(AndroidJUnit4::class)
@LargeTest
class HeadyWorkProfileE2ETest {
    @get:Rule val wpRule = HeadyWorkProfileTestRule()

    @Test
    fun profileOwnerIsHeadyBuddyWork() {
        val dpm = ctx.getSystemService(DevicePolicyManager::class.java)
        assertTrue(dpm.isProfileOwnerApp("com.headysystems.buddy.work"))
    }

    @Test
    fun taskBlockedWhenPermissionRevoked() {
        // Set REVOKED, send task, verify rejection + notification
    }

    @Test
    fun emergencyStopCancelsAllTasks() {
        // Start 3 tasks, triple-press volume-down, verify all cancelled
    }

    @Test
    fun fullTaskFlowEndToEnd() {
        // Grant access, send task, verify AppFunction called, memory logged
    }
}
```

## Layer 4: Heady Eval Engine (Adapted from Mission Control)

```kotlin
class HeadyEvalEngine(private val db: HeadyEvalDatabase) {
    // L1: Task Completion (threshold ≥ 70%)
    fun evalTaskCompletion(agentId: String, hours: Int = 168): EvalResult {
        val stats = db.taskDao().getCompletionStats(agentId, since(hours))
        val score = if (stats.total > 0) stats.completed.toFloat() / stats.total else 1f
        return EvalResult(EvalLayer.OUTPUT, score, score >= 0.70f,
            "${stats.completed}/${stats.total} (${(score*100).toInt()}%)")
    }

    // L2: Loop Detection (tool:unique ratio ≤ 3:1)
    fun evalReasoningCoherence(agentId: String, hours: Int = 24): EvalResult {
        val stats = db.toolCallDao().getCallStats(agentId, since(hours))
        val ratio = if (stats.unique > 0) stats.total.toFloat() / stats.unique else 1f
        return EvalResult(EvalLayer.TRACE, minOf(1f, 3f/ratio), ratio <= 3f,
            "${stats.total}/${stats.unique} (ratio ${ratio.format(1)})")
    }

    // L3: Tool Reliability (threshold ≥ 80%)
    fun evalToolReliability(agentId: String, hours: Int = 24): EvalResult {
        val stats = db.toolCallDao().getReliabilityStats(agentId, since(hours))
        val score = if (stats.total > 0) stats.ok.toFloat() / stats.total else 1f
        return EvalResult(EvalLayer.COMPONENT, score, score >= 0.80f,
            "Reliability: ${(score*100).toInt()}%")
    }

    // L4: Drift Detection (≤ 10% deviation from 4-week baseline)
    fun runDriftCheck(agentId: String): List<DriftResult> = listOf(
        checkDrift("avg_tokens", db.tokenDao().avg(agentId, week(1)), db.tokenDao().avg(agentId, week(4))),
        checkDrift("tool_success", db.toolCallDao().rate(agentId, week(1)), db.toolCallDao().rate(agentId, week(4))),
        checkDrift("completion", db.taskDao().rate(agentId, week(1)), db.taskDao().rate(agentId, week(4)))
    )

    private fun checkDrift(m: String, cur: Float, base: Float): DriftResult {
        val delta = if (base != 0f) abs(cur - base) / abs(base) else if (cur != 0f) 1f else 0f
        return DriftResult(m, cur, base, delta, delta > 0.10f)
    }

    fun runFullEval(agentId: String): FullEvalReport {
        val results = listOf(evalTaskCompletion(agentId),
            evalReasoningCoherence(agentId), evalToolReliability(agentId))
        val drift = runDriftCheck(agentId)
        return FullEvalReport(results, drift, results.all { it.passed } && drift.none { it.drifted })
    }
}
```

## Continuous Eval (WorkManager)

```kotlin
class HeadyEvalWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val report = HeadyEvalEngine(HeadyEvalDatabase.getInstance(applicationContext))
            .runFullEval("heady-buddy-android")
        if (!report.allPassed) {
            HeadyCloudBridge.getInstance(applicationContext).sendMessage(
                HeadyMessage.EvalAlert("heady-buddy-android",
                    report.results.filter { !it.passed }.map { it.layer.name },
                    report.driftResults.filter { it.drifted }.map { it.metric }))
            if (report.results.any { it.score < 0.50f })
                HeadyTaskExecutor.getInstance(applicationContext).pauseForEval()
        }
        return Result.success()
    }
}

// Schedule hourly in Application.onCreate():
WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("heady-eval",
    ExistingPeriodicWorkPolicy.KEEP,
    PeriodicWorkRequestBuilder<HeadyEvalWorker>(1, TimeUnit.HOURS)
        .setConstraints(Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build())
```

## Custom Lint: No Localhost

```kotlin
class HeadyNoLocalhostDetector : Detector(), Detector.UastScanner {
    override fun getApplicableUastTypes() = listOf(ULiteralExpression::class.java)
    override fun visitLiteralExpression(ctx: JavaContext, node: ULiteralExpression) {
        val v = node.value as? String ?: return
        if (v.contains("localhost") || v.contains("127.0.0.1"))
            ctx.report(ISSUE, node, ctx.getLocation(node),
                "HeadyBuddy must never reference localhost. Use api.headysystems.com")
    }
    companion object {
        val ISSUE = Issue.create("HeadyNoLocalhost", "Localhost reference detected",
            "All Heady endpoints must use production URLs via Cloudflare tunnel.",
            Category.CORRECTNESS, 10, Severity.ERROR,
            Implementation(HeadyNoLocalhostDetector::class.java, Scope.JAVA_FILE_SCOPE))
    }
}
```

## CI/CD Pipeline (GitHub Actions)

```yaml
name: HeadyBuddy Android CI
on:
  push:
    paths: ['headybuddy-mobile/**']
  pull_request:
    paths: ['headybuddy-mobile/**']

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew :app-work:detekt :app-companion:detekt
      - run: ./gradlew :app-work:lint :app-companion:lint
      - name: Fail on localhost
        run: |
          if grep -r "localhost\|127\.0\.0\.1" headybuddy-mobile/*/src; then
            echo "ERROR: localhost reference found"; exit 1
          fi

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew testDebugUnitTest
      - run: ./gradlew koverReport
      - name: Coverage gate (≥80%)
        run: |
          COV=$(grep -oP '(?<=e rate=")[^"]+' build/reports/kover/report.xml | head -1)
          python3 -c "import sys; sys.exit(0 if float('$COV') >= 0.80 else 1)"

  instrumented-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 36
          script: ./gradlew connectedDebugAndroidTest

  work-profile-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./gradlew assembleDebug
      - name: Firebase Test Lab
        run: |
          gcloud firebase test android run \
            --type instrumentation \
            --app app-companion/build/outputs/apk/debug/*.apk \
            --test app-work/build/outputs/apk/androidTest/debug/*.apk \
            --device model=Pixel8,version=36 \
            --timeout 10m --use-orchestrator

  eval-gate:
    needs: [unit-tests, instrumented-tests]
    runs-on: ubuntu-latest
    steps:
      - name: Run Heady Eval
        run: |
          curl -X POST https://api.headysystems.com/v1/eval/run \
            -H "Authorization: Bearer ${{ secrets.HEADY_CI_TOKEN }}" \
            -d '{"agentId":"heady-buddy-android","environment":"staging"}'
      - name: Assert pass
        run: |
          R=$(curl -s https://api.headysystems.com/v1/eval/latest?agentId=heady-buddy-android-staging)
          python3 -c "import json,sys; sys.exit(0 if json.loads('$R')['allPassed'] else 1)"
```

## Coverage Matrix

| Layer | Tool | What It Catches | Gate |
|-------|------|----------------|------|
| Static | Detekt, ktlint | Style, complexity, anti-patterns | Pre-commit |
| Custom Lint | HeadyLint | localhost refs, hardcoded tokens | Pre-commit |
| Unit | JUnit5 + MockK | Logic errors, permission paths | PR required |
| Integration | MockWebServer | WSS protocol, API responses, DB | PR required |
| Instrumented | Espresso + UIAutomator | Android lifecycle, Keystore | PR required |
| Work Profile E2E | Firebase Test Lab | Full provisioning, cross-profile | PR required |
| Eval L1 | HeadyEvalEngine | Task completion ≥ 70% | Canary gate |
| Eval L2 | HeadyEvalEngine | Loop detection (ratio ≤ 3:1) | Canary gate |
| Eval L3 | HeadyEvalEngine | Tool reliability ≥ 80% | Canary gate |
| Eval L4 | HeadyEvalEngine | Drift ≤ 10% vs baseline | Production gate |
| Crashes | Firebase Crashlytics | Runtime exceptions | Continuous |
| Perf | Firebase Performance | Bootstrap time, latency, ANR | Continuous |

## Canary Release Ladder

```
Internal (HeadySystems) → 1% → 5% → 20% → 100%
         24h              24h   48h    72h
```

**Auto-rollback triggers** (any one halts canary):
- Crash-free rate < 99.5%
- Task success rate < 97%
- P99 memory bootstrap > 3000ms
- Any eval layer below threshold for 3 consecutive hourly checks
- Emergency stop rate > 2% of sessions

HeadyQA node has authority to halt rollout automatically via
`POST api.headysystems.com/v1/releases/{releaseId}/halt` — no human needed.

---

*© 2026 HeadySystems Inc. — Eric Haywood, Founder — 60+ Provisional Patents*
*Prepared by HeadyBuddy Build Agent — Pocket Lattice v1.0*
