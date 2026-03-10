#!/usr/bin/env python3
"""
Heady™ Gamma Runtime — Training Forge
Colab Pro+ Notebook for fine-tuning, LoRA, RLHF, distillation
Author: Eric Haywood / HeadySystems Inc. — 51 Provisional Patents

Run on: Colab Pro+ with A100 GPU
"""

PHI = 1.618033988749895
PSI = 1 / PHI
FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987]

import os
import json
import time
import numpy as np
import torch
import asyncio
import websockets

# ═══ Training Configuration — φ-scaled hyperparameters ═══
TRAIN_CONFIG = {
    "learning_rate": PSI**8,          # ≈ 0.0131 (was hardcoded 0.01)
    "warmup_ratio": PSI**3,           # ≈ 0.236 (was hardcoded 0.1)
    "weight_decay": PSI**5,           # ≈ 0.090 (was hardcoded 0.01)
    "batch_size": FIB[6],             # 8
    "gradient_accumulation": FIB[5],  # 5
    "max_epochs": FIB[7],             # 13
    "eval_steps": FIB[12],            # 144
    "save_steps": FIB[14],            # 377
    "lora_rank": FIB[6],              # 8
    "lora_alpha": FIB[8],             # 21
    "lora_dropout": PSI**4,           # ≈ 0.146
}

def lora_fine_tune(base_model_name: str, dataset_path: str, output_dir: str) -> dict:
    """LoRA fine-tuning with φ-scaled hyperparameters."""
    from peft import LoraConfig, get_peft_model, TaskType
    from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
    from datasets import load_dataset

    print(f"[GAMMA] Starting LoRA fine-tune: {base_model_name}")
    start = time.time()

    tokenizer = AutoTokenizer.from_pretrained(base_model_name)
    model = AutoModelForCausalLM.from_pretrained(base_model_name, torch_dtype=torch.float16, device_map="auto")

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=TRAIN_CONFIG["lora_rank"],
        lora_alpha=TRAIN_CONFIG["lora_alpha"],
        lora_dropout=TRAIN_CONFIG["lora_dropout"],
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    )
    model = get_peft_model(model, lora_config)

    dataset = load_dataset("json", data_files=dataset_path, split="train")

    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=TRAIN_CONFIG["max_epochs"],
        per_device_train_batch_size=TRAIN_CONFIG["batch_size"],
        gradient_accumulation_steps=TRAIN_CONFIG["gradient_accumulation"],
        learning_rate=TRAIN_CONFIG["learning_rate"],
        warmup_ratio=TRAIN_CONFIG["warmup_ratio"],
        weight_decay=TRAIN_CONFIG["weight_decay"],
        fp16=True,
        logging_steps=FIB[7],      # 13
        eval_steps=TRAIN_CONFIG["eval_steps"],
        save_steps=TRAIN_CONFIG["save_steps"],
        save_total_limit=FIB[4],    # 3
    )

    trainer = Trainer(model=model, args=training_args, train_dataset=dataset, tokenizer=tokenizer)
    trainer.train()
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)

    duration_s = time.time() - start
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())

    return {
        "baseModel": base_model_name,
        "outputDir": output_dir,
        "trainableParams": trainable,
        "totalParams": total,
        "trainablePercent": trainable / total * 100,
        "durationSeconds": duration_s,
        "config": TRAIN_CONFIG,
    }

def quantize_model(model_path: str, output_path: str, bits: int = FIB[5]) -> dict:
    """Quantize model to reduce size (Fibonacci-aligned bit width)."""
    from transformers import AutoModelForCausalLM, BitsAndBytesConfig

    print(f"[GAMMA] Quantizing model to {bits}-bit: {model_path}")
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=(bits == FIB[4]),
        load_in_8bit=(bits == FIB[6]),
    )

    model = AutoModelForCausalLM.from_pretrained(model_path, quantization_config=quantization_config, device_map="auto")
    model.save_pretrained(output_path)

    return {"modelPath": model_path, "outputPath": output_path, "bits": bits}

# ═══ Bridge Protocol ═══
GATEWAY_URL = os.environ.get('HEADY_GATEWAY_URL', 'wss://gateway.headysystems.com/colab/gamma')
RUNTIME_ID = 'runtime-gamma'

async def connect_to_gateway():
    attempt = 0
    while True:
        try:
            async with websockets.connect(GATEWAY_URL) as ws:
                attempt = 0
                print(f"[GAMMA] Connected to gateway")
                await ws.send(json.dumps({
                    "type": "register",
                    "runtimeId": RUNTIME_ID,
                    "role": "training",
                    "gpuType": "A100" if torch.cuda.is_available() else "CPU",
                    "gpuMemoryMB": int(torch.cuda.get_device_properties(0).total_mem / 1024**2) if torch.cuda.is_available() else 0,
                    "capabilities": ["fine-tune", "train", "rlhf", "distill", "quantize", "lora"],
                }))

                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=FIB[9])  # 55s (longer for training)
                        data = json.loads(msg)
                        if data["type"] == "task":
                            result = await handle_task(data)
                            await ws.send(json.dumps(result))
                        elif data["type"] == "ping":
                            await ws.send(json.dumps({"type": "heartbeat", "runtimeId": RUNTIME_ID}))
                    except asyncio.TimeoutError:
                        await ws.send(json.dumps({"type": "heartbeat", "runtimeId": RUNTIME_ID}))
        except Exception as e:
            delay = min(1000 * PHI**attempt, FIB[10] * 1000) / 1000
            jitter = 1 + (np.random.random() - 0.5) * 2 * PSI**2
            print(f"[GAMMA] Reconnecting in {delay * jitter:.1f}s (attempt {attempt})")
            await asyncio.sleep(delay * jitter)
            attempt += 1

async def handle_task(data: dict) -> dict:
    task_type = data.get("taskType")
    payload = data.get("payload", {})
    task_id = data.get("taskId", "unknown")
    start = time.time()

    try:
        if task_type == "fine-tune" or task_type == "lora":
            result = lora_fine_tune(payload["baseModel"], payload["datasetPath"], payload["outputDir"])
        elif task_type == "quantize":
            result = quantize_model(payload["modelPath"], payload["outputPath"], payload.get("bits", FIB[5]))
        else:
            result = {"error": f"Unknown task type: {task_type}"}

        return {"type": "result", "taskId": task_id, "status": "completed", "result": result, "latencyMs": (time.time() - start) * 1000}
    except Exception as e:
        return {"type": "result", "taskId": task_id, "status": "failed", "error": str(e), "latencyMs": (time.time() - start) * 1000}

if __name__ == "__main__":
    print(f"[GAMMA] Heady Training Forge v4.0.0")
    print(f"[GAMMA] φ-scaled hyperparameters: lr={TRAIN_CONFIG['learning_rate']:.6f}, wd={TRAIN_CONFIG['weight_decay']:.6f}")
    asyncio.run(connect_to_gateway())
