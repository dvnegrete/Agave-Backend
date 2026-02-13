import { HouseBalance } from '@/shared/database/entities';

/**
 * Interface para el repositorio de Saldos de Casa
 * Define el contrato para operaciones de persistencia de house_balances
 */
export interface IHouseBalanceRepository {
  /**
   * Encuentra el saldo de una casa por ID
   */
  findByHouseId(houseId: number): Promise<HouseBalance | null>;

  /**
   * Crea un nuevo saldo para una casa
   */
  create(houseId: number): Promise<HouseBalance>;

  /**
   * Actualiza el saldo de una casa
   */
  update(
    houseId: number,
    balance: Partial<HouseBalance>,
  ): Promise<HouseBalance>;

  /**
   * Obtiene o crea el saldo de una casa
   */
  getOrCreate(houseId: number): Promise<HouseBalance>;

  /**
   * Incrementa el saldo a favor (crédito)
   */
  addCreditBalance(houseId: number, amount: number): Promise<HouseBalance>;

  /**
   * Decrementa el saldo a favor (crédito)
   */
  subtractCreditBalance(houseId: number, amount: number): Promise<HouseBalance>;

  /**
   * Incrementa la deuda (débito)
   */
  addDebitBalance(houseId: number, amount: number): Promise<HouseBalance>;

  /**
   * Decrementa la deuda (débito)
   */
  subtractDebitBalance(houseId: number, amount: number): Promise<HouseBalance>;

  /**
   * Incrementa los centavos acumulados
   */
  addAccumulatedCents(houseId: number, amount: number): Promise<HouseBalance>;

  /**
   * Resetea los centavos acumulados a 0
   */
  resetAccumulatedCents(houseId: number): Promise<HouseBalance>;

  /**
   * Encuentra saldos con deuda
   */
  findWithDebt(): Promise<HouseBalance[]>;

  /**
   * Encuentra saldos con crédito
   */
  findWithCredit(): Promise<HouseBalance[]>;

  /**
   * Elimina el saldo de una casa
   */
  delete(houseId: number): Promise<boolean>;

  /**
   * Resetea todos los saldos a 0 (credit, debit, cents)
   */
  resetAll(): Promise<number>;
}
