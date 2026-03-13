import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '@/shared/database/repositories/user.repository';
import { FirebaseAuthConfig } from '@/shared/auth/services/firebase-auth.config';
import { UserResponseDto } from '../dto';
import { SYSTEM_USER_EMAIL } from '@/shared/config/business-rules.config';

@Injectable()
export class GetUsersUseCase {
  private readonly logger = new Logger(GetUsersUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly firebaseAuthConfig: FirebaseAuthConfig,
  ) {}

  async execute(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll();

    const filteredUsers = users.filter((u) => u.email !== SYSTEM_USER_EMAIL);

    // Fetch provider info from Firebase in a single batched call
    const providerMap = await this.fetchProviderMap(filteredUsers.map((u) => u.id));

    return filteredUsers.map((user) => ({
      id: user.id,
      role: user.role,
      status: user.status,
      name: user.name,
      email: user.email,
      observations: user.observations,
      cel_phone: user.cel_phone,
      houses: (user.houses || []).map((house) => house.number_house),
      created_at: user.created_at,
      updated_at: user.updated_at,
      auth_provider: providerMap.get(user.id) ?? null,
    }));
  }

  /**
   * Fetches the primary auth provider for each UID from Firebase Admin SDK.
   * Uses getUsers() which accepts up to 100 identifiers per call.
   * Returns a Map of uid → provider string (e.g. 'google', 'password').
   * Fails gracefully: if Firebase is unavailable, returns an empty Map.
   */
  private async fetchProviderMap(uids: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();

    if (!this.firebaseAuthConfig.isEnabled() || uids.length === 0) {
      return map;
    }

    try {
      const auth = this.firebaseAuthConfig.getAuth();

      // Firebase getUsers accepts up to 100 identifiers per call; chunk if needed
      const BATCH_SIZE = 100;
      for (let i = 0; i < uids.length; i += BATCH_SIZE) {
        const batch = uids.slice(i, i + BATCH_SIZE);
        const result = await auth.getUsers(batch.map((uid) => ({ uid })));

        for (const firebaseUser of result.users) {
          const primaryProvider = firebaseUser.providerData?.[0]?.providerId ?? null;
          // Normalize: 'google.com' → 'google', 'password' stays 'password'
          map.set(firebaseUser.uid, primaryProvider?.replace('.com', '') ?? null);
        }
      }
    } catch (error) {
      this.logger.warn('No se pudo obtener proveedores de Firebase; auth_provider será null', error);
    }

    return map;
  }
}
