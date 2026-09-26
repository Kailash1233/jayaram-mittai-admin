'use server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { requireAdmin } from './data';
import { supabase } from './supabase';
import type { ActionResult } from './model';
const accountSchema = z
  .object({
    display_name: z.string().trim().min(1).max(150),
    email: z.string().email(),
    password: z.string().min(12, 'Use a password of at least 12 characters.'),
    user_role: z.enum(['owner', 'manager', 'store_supervisor', 'outlet_supervisor']),
    location_id: z.string(),
  })
  .refine(
    (v) =>
      ['owner', 'manager'].includes(v.user_role) ||
      z.string().uuid().safeParse(v.location_id).success,
    { message: 'Select the supervisor’s location.', path: ['location_id'] },
  );
export async function createAccount(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
    const v = accountSchema.parse(input);
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret)
      return {
        ok: false,
        message:
          'Account creation needs the server-only provisioning key. Existing accounts can still use the app.',
      };
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
      db: {
        schema: 'InternalOperations',
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
    });
    if (error || !data.user)
      return {
        ok: false,
        message:
          'Unable to create this login. Check whether the email is already registered and meets your password policy.',
      };
    const { error: profileError } = await db.from('user_accounts').insert({
      auth_user_id: data.user.id,
      display_name: v.display_name,
      user_role: v.user_role,
      location_id: ['owner', 'manager'].includes(v.user_role) ? null : v.location_id,
      is_active: true,
    });
    if (profileError) {
      const cleanup = await db.auth.admin.deleteUser(data.user.id);
      return {
        ok: false,
        message: cleanup.error
          ? 'Profile creation failed and login cleanup needs attention in Supabase.'
          : 'Profile creation failed. Check the role/location and existing active supervisor. The new login was removed.',
      };
    }
    revalidatePath('/admin/users');
    return {
      ok: true,
      message: 'Login account created. Share the credentials securely with its intended user.',
    };
  } catch (e) {
    unstable_rethrow(e);
    return {
      ok: false,
      message: e instanceof z.ZodError ? e.issues[0].message : 'Unable to create the account.',
    };
  }
}
export async function updateAccount(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
    const v = z
      .object({
        user_account_id: z.string().uuid(),
        display_name: z.string().trim().min(1).max(150),
        user_role: z.enum(['owner', 'manager', 'store_supervisor', 'outlet_supervisor']),
        location_id: z.string(),
        is_active: z.boolean(),
      })
      .parse(input);
    const db = await supabase();
    const { error } = await db.rpc('update_user_access', {
      p_user_account_id: v.user_account_id,
      p_display_name: v.display_name,
      p_user_role: v.user_role,
      p_location_id: ['owner', 'manager'].includes(v.user_role) ? null : v.location_id,
      p_is_active: v.is_active,
    });
    if (error)
      return {
        ok: false,
        message:
          error.code === 'PGRST202'
            ? 'Account editing requires the optional app-support.sql function. See setup instructions.'
            : error.code === '23505'
              ? 'This location already has an active supervisor.'
              : 'Unable to update access. Keep at least one active administrator and verify the role/location.',
      };
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Account access updated.' };
  } catch (e) {
    unstable_rethrow(e);
    return {
      ok: false,
      message: e instanceof z.ZodError ? e.issues[0].message : 'Administrator access required.',
    };
  }
}
