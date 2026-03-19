# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<<<<<<< HEAD
# ║  FILE: src/heady_project/economy.py                              ║
# ║  LAYER: backend/src                                              ║
=======
# ║  FILE: src/heady_project/economy.py                                                    ║
# ║  LAYER: backend/src                                                  ║
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

"""
HeadyCoin Token Economy — Manages token minting, balances, transfers,
and staking within the Heady ecosystem.
"""

from .utils import get_logger
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional

logger = get_logger(__name__)

# ═══════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════

INITIAL_SUPPLY = 1_000_000
MAX_SUPPLY = 10_000_000
MINT_BATCH_LIMIT = 10_000
STAKING_REWARD_RATE = 0.05  # 5% annual


@dataclass
class Transaction:
    """A single token transaction record."""
    tx_id: str
    timestamp: str
    from_account: str
    to_account: str
    amount: int
    tx_type: str  # mint, transfer, burn, stake, unstake
    memo: str = ""


@dataclass
class Account:
    """A wallet account holding HeadyCoins."""
    account_id: str
    balance: int = 0
    staked: int = 0
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    transactions: List[str] = field(default_factory=list)


class HeadyCoinEconomy:
    """Token economy engine for HeadyCoin."""

    def __init__(self):
        self.total_supply = 0
        self.accounts: Dict[str, Account] = {}
        self.ledger: List[Transaction] = []
        self._tx_counter = 0

        # Create the treasury account
        self._ensure_account("treasury")

    def _next_tx_id(self) -> str:
        self._tx_counter += 1
        return f"tx-{self._tx_counter:08d}"

    def _ensure_account(self, account_id: str) -> Account:
        if account_id not in self.accounts:
            self.accounts[account_id] = Account(account_id=account_id)
            logger.info(f"Account created: {account_id}")
        return self.accounts[account_id]

    def _record(self, tx: Transaction):
        self.ledger.append(tx)
        self.accounts[tx.from_account].transactions.append(tx.tx_id)
        if tx.to_account != tx.from_account:
            self.accounts[tx.to_account].transactions.append(tx.tx_id)

    # ─── Core Operations ──────────────────────────────────────────

    def mint_coin(self, amount: int, to_account: str = "treasury") -> Transaction:
        """Mint new HeadyCoins into an account."""
        if amount <= 0:
            raise ValueError("Amount must be positive")
        if amount > MINT_BATCH_LIMIT:
            raise ValueError(f"Mint batch limit is {MINT_BATCH_LIMIT}")
        if self.total_supply + amount > MAX_SUPPLY:
            raise ValueError(f"Would exceed max supply of {MAX_SUPPLY}")

        acct = self._ensure_account(to_account)
        acct.balance += amount
        self.total_supply += amount

        tx = Transaction(
            tx_id=self._next_tx_id(),
            timestamp=datetime.now().isoformat(),
            from_account="mint",
            to_account=to_account,
            amount=amount,
            tx_type="mint",
        )
        self._ensure_account("mint")
        self._record(tx)

        logger.info(f"Minted {amount} HeadyCoins to {to_account}. Supply: {self.total_supply}")
        return tx

    def transfer(self, from_account: str, to_account: str, amount: int, memo: str = "") -> Transaction:
        """Transfer tokens between accounts."""
        if amount <= 0:
            raise ValueError("Amount must be positive")

        sender = self._ensure_account(from_account)
        if sender.balance < amount:
            raise ValueError(f"Insufficient balance: {sender.balance} < {amount}")

        receiver = self._ensure_account(to_account)
        sender.balance -= amount
        receiver.balance += amount

        tx = Transaction(
            tx_id=self._next_tx_id(),
            timestamp=datetime.now().isoformat(),
            from_account=from_account,
            to_account=to_account,
            amount=amount,
            tx_type="transfer",
            memo=memo,
        )
        self._record(tx)

        logger.info(f"Transfer: {from_account} -> {to_account}: {amount} coins")
        return tx

    def burn(self, account_id: str, amount: int) -> Transaction:
        """Burn tokens from an account, reducing total supply."""
        acct = self._ensure_account(account_id)
        if acct.balance < amount:
            raise ValueError(f"Insufficient balance to burn: {acct.balance} < {amount}")

        acct.balance -= amount
        self.total_supply -= amount

        tx = Transaction(
            tx_id=self._next_tx_id(),
            timestamp=datetime.now().isoformat(),
            from_account=account_id,
            to_account="burn",
            amount=amount,
            tx_type="burn",
        )
        self._ensure_account("burn")
        self._record(tx)

        logger.info(f"Burned {amount} from {account_id}. Supply: {self.total_supply}")
        return tx

    def stake(self, account_id: str, amount: int) -> Transaction:
        """Stake tokens from an account's balance."""
        acct = self._ensure_account(account_id)
        if acct.balance < amount:
            raise ValueError(f"Insufficient balance to stake: {acct.balance} < {amount}")

        acct.balance -= amount
        acct.staked += amount

        tx = Transaction(
            tx_id=self._next_tx_id(),
            timestamp=datetime.now().isoformat(),
            from_account=account_id,
            to_account=account_id,
            amount=amount,
            tx_type="stake",
        )
        self._record(tx)

        logger.info(f"Staked {amount} for {account_id}. Staked total: {acct.staked}")
        return tx

    def unstake(self, account_id: str, amount: int) -> Transaction:
        """Unstake tokens back to the account's balance."""
        acct = self._ensure_account(account_id)
        if acct.staked < amount:
            raise ValueError(f"Insufficient staked amount: {acct.staked} < {amount}")

        acct.staked -= amount
        acct.balance += amount

        tx = Transaction(
            tx_id=self._next_tx_id(),
            timestamp=datetime.now().isoformat(),
            from_account=account_id,
            to_account=account_id,
            amount=amount,
            tx_type="unstake",
        )
        self._record(tx)

        logger.info(f"Unstaked {amount} for {account_id}")
        return tx

    # ─── Queries ──────────────────────────────────────────────────

    def get_balance(self, account_id: str) -> Dict:
        acct = self._ensure_account(account_id)
        return {"account": account_id, "balance": acct.balance, "staked": acct.staked}

    def get_supply(self) -> Dict:
        return {"total_supply": self.total_supply, "max_supply": MAX_SUPPLY, "accounts": len(self.accounts)}

    def get_ledger(self, limit: int = 50) -> List[Dict]:
        return [
            {"tx_id": tx.tx_id, "type": tx.tx_type, "from": tx.from_account,
             "to": tx.to_account, "amount": tx.amount, "timestamp": tx.timestamp}
            for tx in self.ledger[-limit:]
        ]


# Global instance
economy = HeadyCoinEconomy()
