import { Module } from '@nestjs/common';
import { DatabaseModule } from './database.module';
import { UsersRepository } from './users.repository';
import { UserDataRepository } from './user-data.repository';

@Module({
  imports: [DatabaseModule],
  providers: [UsersRepository, UserDataRepository],
  exports: [UsersRepository, UserDataRepository],
})
export class RepositoriesModule {}
