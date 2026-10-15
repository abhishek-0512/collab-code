import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, IUser } from '../models/User';
import { signToken } from '../utils/jwt';
import type { RegisterInput, LoginInput } from '../validators/auth.validator';

// In-memory fallback if MongoDB is not connected
interface MemoryUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}
const memoryUsers = new Map<string, MemoryUser>();

function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function registerUser(input: RegisterInput) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const normalizedUsername = input.username.trim();

  if (isMongoConnected()) {
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) throw new Error('Email is already registered');

    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) throw new Error('Username is already taken');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      },
    };
  }

  // Memory fallback
  for (const u of memoryUsers.values()) {
    if (u.email === normalizedEmail) throw new Error('Email is already registered');
    if (u.username.toLowerCase() === normalizedUsername.toLowerCase()) throw new Error('Username is already taken');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const id = new mongoose.Types.ObjectId().toString();
  const memUser: MemoryUser = {
    id,
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date(),
  };
  memoryUsers.set(id, memUser);

  const token = signToken({
    userId: id,
    email: memUser.email,
    username: memUser.username,
  });

  return {
    token,
    user: {
      id,
      username: memUser.username,
      email: memUser.email,
    },
  };
}

export async function loginUser(input: LoginInput) {
  const normalizedEmail = input.email.toLowerCase().trim();

  if (isMongoConnected()) {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) throw new Error('Invalid email or password');

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new Error('Invalid email or password');

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
      },
    };
  }

  // Memory fallback
  let foundUser: MemoryUser | undefined;
  for (const u of memoryUsers.values()) {
    if (u.email === normalizedEmail) {
      foundUser = u;
      break;
    }
  }

  if (!foundUser) throw new Error('Invalid email or password');

  const valid = await bcrypt.compare(input.password, foundUser.passwordHash);
  if (!valid) throw new Error('Invalid email or password');

  const token = signToken({
    userId: foundUser.id,
    email: foundUser.email,
    username: foundUser.username,
  });

  return {
    token,
    user: {
      id: foundUser.id,
      username: foundUser.username,
      email: foundUser.email,
    },
  };
}

export async function getUserById(userId: string) {
  if (isMongoConnected()) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) throw new Error('User not found');
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  let memUser = memoryUsers.get(userId);
  if (!memUser) {
    // In-memory recovery for development sessions
    memUser = {
      id: userId,
      username: 'User ' + userId.slice(-4),
      email: `${userId}@dev.local`,
      passwordHash: '',
      createdAt: new Date(),
    };
    memoryUsers.set(userId, memUser);
  }

  return {
    id: memUser.id,
    username: memUser.username,
    email: memUser.email,
    createdAt: memUser.createdAt,
  };
}
