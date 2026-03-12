#!/usr/bin/env python3
"""
Heady Battle Arena Task Pack Builder
Bundles all files needed to accomplish tasks from the thread.
Generates: heady-battle-arena-task-pack.zip
"""

import os
import zipfile
from datetime import datetime

# Configuration
OUTPUT_ZIP = "heady-battle-arena-task-pack.zip"
BUILD_DIR = "heady-battle-pack-temp"

# Required local files (place in same directory as this script)
REQUIRED_FILES = [
    "04-battle-arena-model-racing.md",
    "Heady_Service_Reference.docx",
    "Heady_System_Architecture_Overview.docx",
    "Heady_Development_Deployment_Guide.docx",
]

def create_readme():
    """Generate README for the task pack."""
    return f"""# Heady Battle Arena Task Pack
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Contents

### /specs/
Core specification and reference documents from thread:
- `04-battle-arena-model-racing.md` - Complete battle arena specification
- `Heady_Service_Reference.docx` - Service reference documentation  
- `Heady_System_Architecture_Overview.docx` - Architecture overview
- `Heady_Development_Deployment_Guide.docx` - Deployment guide

### /manifests/
- `TASK_BACKLOG.md` - Extracted task breakdown
- `FILE_MANIFEST.txt` - Complete file listing

## Implementation Overview

This pack contains everything needed to implement the Heady Battle Arena system:

1. **Battle-Sim Task Orchestrator** (9-stage pipeline)
   - Sim → CSL Gate → Battle/MC → Bee → Swarm

2. **Arena Contestant Management**
   - Perplexity Sonar, Claude, GPT-4, Gemini
   - Judge models and tournament brackets

3. **Comparison Framework**
   - compareOutputs (Jaccard, hash match, phi-weighted)
   - comparePipelineRuns with determinism verdicts

4. **Perplexity Integration**
   - Mode selection (research/analyze/extract)
   - Budget management and memory persistence

5. **Task Dispatcher Enhancement**
   - heady-battle and heady-sims SUB_AGENTS

6. **Test Suite**
   - Jest tests for sim, battle, MC, and full pipeline

## Quick Start

1. Review `specs/04-battle-arena-model-racing.md` for complete specification
2. Check `manifests/TASK_BACKLOG.md` for prioritized task breakdown
3. Reference architecture and deployment docs as needed
4. Begin implementation following the 9-stage pipeline design

## Notes

- All files are deduplicated (thread contained duplicate attachments)
- Specification is comprehensive and implementation-ready
- Follow HeadySystems coding standards and patterns
"""

def create_task_backlog():
    """Generate extracted task backlog."""
    return """# Heady Battle Arena - Task Backlog
Extracted from: 04-battle-arena-model-racing.md

## Epic 1: Battle-Sim Task Orchestrator
**Priority: P0 - Foundation**

### Tasks:
1.1 Implement 9-stage pipeline coordinator
1.2 Build Sim stage (initial task analysis)
1.3 Build CSL Gate (complexity/scope/length evaluation)
1.4 Build Battle/MC stage (model racing and Monte Carlo sampling)
1.5 Build Bee stage (iterative refinement)
1.6 Build Swarm stage (multi-agent coordination)
1.7 Implement stage transition logic and data flow
1.8 Add pipeline state management
1.9 Integrate with existing TaskDispatcher

## Epic 2: Arena Contestant Management
**Priority: P0 - Core Functionality**

### Tasks:
2.1 Register contestant models (Perplexity Sonar, Claude, GPT-4, Gemini)
2.2 Configure deterministic settings (temp=0, seed=42)
2.3 Implement judge model system
2.4 Build tournament bracket logic
2.5 Add contestant capability tracking
2.6 Implement model selection strategy
2.7 Add performance metrics collection

## Epic 3: Comparison Framework
**Priority: P0 - Critical Feature**

### Tasks:
3.1 Implement compareOutputs function
   - Jaccard similarity calculation
   - Hash-based exact matching
   - Phi-weighted comparison
3.2 Implement comparePipelineRuns function
   - Cross-run comparison logic
   - Determinism verdict generation
3.3 Add comparison result visualization
3.4 Integrate with battle results

## Epic 4: Perplexity Integration
**Priority: P1 - Key Integration**

### Tasks:
4.1 Wire PerplexityResearchService API
4.2 Implement mode selection (research/analyze/extract)
4.3 Add budget management system
4.4 Implement memory persistence
4.5 Add error handling and retry logic
4.6 Configure rate limiting
4.7 Add usage tracking and reporting

## Epic 5: Task Dispatcher Enhancement
**Priority: P1 - System Integration**

### Tasks:
5.1 Map heady-battle SUB_AGENT
5.2 Map heady-sims SUB_AGENT
5.3 Update routing logic for new agents
5.4 Add agent capability detection
5.5 Implement fallback strategies

## Epic 6: Test Suite
**Priority: P0 - Quality Assurance**

### Tasks:
6.1 Write unit tests for Sim stage
6.2 Write unit tests for Battle/MC stage
6.3 Write integration tests for 9-stage pipeline
6.4 Write tests for comparison framework
6.5 Write tests for Perplexity integration
6.6 Add end-to-end pipeline tests
6.7 Add performance benchmarks
6.8 Set up CI/CD test automation

## Dependencies & Blockers

- Perplexity API access and credentials (REQUIRED)
- Model API keys for all contestants (REQUIRED)
- Existing TaskDispatcher codebase access (REQUIRED)
- Test environment setup (REQUIRED)

## Acceptance Criteria

✓ All 9 stages execute successfully in sequence
✓ Deterministic model outputs verified (temp=0, seed=42)
✓ Comparison framework produces accurate similarity metrics
✓ Perplexity integration handles all three modes
✓ Test suite achieves >90% code coverage
✓ Full pipeline completes within performance targets
✓ Documentation complete and up-to-date
"""

def create_file_manifest(files_added):
    """Generate file manifest."""
    manifest = f"# File Manifest\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    manifest += f"Total files: {len(files_added)}\n\n"
    
    for filepath in sorted(files_added):
        manifest += f"- {filepath}\n"
    
    return manifest

def build_zip():
    """Main build function."""
    print("🔨 Building Heady Battle Arena Task Pack...")
    
    # Check for required files
    missing = [f for f in REQUIRED_FILES if not os.path.exists(f)]
    if missing:
        print("\n❌ ERROR: Missing required files:")
        for f in missing:
            print(f"   - {f}")
        print("\nPlace these files in the same directory as this script and run again.")
        return False
    
    # Create zip
    files_added = []
    with zipfile.ZipFile(OUTPUT_ZIP, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add specs
        print("📄 Adding specification files...")
        for filename in REQUIRED_FILES:
            arcname = f"specs/{filename}"
            zf.write(filename, arcname)
            files_added.append(arcname)
            print(f"   ✓ {filename}")
        
        # Add generated manifests
        print("📋 Generating manifests...")
        
        zf.writestr("README.md", create_readme())
        files_added.append("README.md")
        print("   ✓ README.md")
        
        zf.writestr("manifests/TASK_BACKLOG.md", create_task_backlog())
        files_added.append("manifests/TASK_BACKLOG.md")
        print("   ✓ TASK_BACKLOG.md")
        
        # Create manifest last (needs full file list)
        manifest_content = create_file_manifest(files_added + ["manifests/FILE_MANIFEST.txt"])
        zf.writestr("manifests/FILE_MANIFEST.txt", manifest_content)
        files_added.append("manifests/FILE_MANIFEST.txt")
        print("   ✓ FILE_MANIFEST.txt")
    
    print(f"\n✅ SUCCESS: {OUTPUT_ZIP} created")
    print(f"   Total files: {len(files_added)}")
    print(f"   Size: {os.path.getsize(OUTPUT_ZIP):,} bytes")
    return True

if __name__ == "__main__":
    build_zip()
