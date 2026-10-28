import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { api } from '@/api/client';
import { supabase } from '@/api/supabase';
import { syncCacheOwner, clearUserData } from '@/lib/userDataReset';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Which shop this account works in (their own, or the shop that invited
  // them), with the role and modules the owner granted.
  const [shopContext, setShopContext] = useState(null);
  const shopContextRef = useRef(null);

  // Reads the membership. An employee who loses access must not keep the shop's
  // cached records on this device, so a change of shop clears the cache.
  const refreshShop = useCallback(async () => {
    let next = null;
    try {
      next = await api.shop.context();
    } catch {
      next = null;
    }
    const previous = shopContextRef.current;
    if (previous?.memberId && (!next || next.shopId !== previous.shopId)) {
      await clearUserData();
    }
    shopContextRef.current = next;
    setShopContext(next);
    return next;
  }, []);

  const can = useCallback((module) => {
    if (!shopContext) return false;
    if (shopContext.isOwner) return true;
    return Boolean(shopContext.permissions?.[module]);
  }, [shopContext]);

  const canEditModule = useCallback((module) => {
    if (!shopContext) return false;
    if (shopContext.isOwner) return true;
    return shopContext.permissions?.[module] === 'edit';
  }, [shopContext]);

  // Loads the signed-in user (auth account + profile) into context.
  const applySession = useCallback(async (session) => {
    // Cached data on this device belongs to whoever was signed in when it was
    // written, so a different account (or a signed-out browser) starts clean.
    await syncCacheOwner(session?.user?.id);

    if (!session?.user) {
      setUser(null);
      setShopContext(null);
      shopContextRef.current = null;
      setIsAuthenticated(false);
      setAuthError(null);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthChecked(true);
      return;
    }

    try {
      const currentUser = await api.auth.me();
      setUser(currentUser);
      await refreshShop();
      setIsAuthenticated(true);
      setAuthError(currentUser.disabled ? { type: 'user_not_registered', message: 'Account disabled' } : null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    } finally {
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthChecked(true);
    }
  }, [refreshShop]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) applySession(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase warns against making auth calls synchronously inside this
      // callback, so defer the profile lookup.
      if (event === 'SIGNED_OUT') {
        setTimeout(() => active && applySession(null), 0);
      } else if (session) {
        setTimeout(() => active && applySession(session), 0);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [applySession]);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  const checkAppState = useCallback(async () => {
    await checkUserAuth();
  }, [checkUserAuth]);

  const logout = useCallback(async (shouldRedirect = true) => {
    setUser(null);
    setShopContext(null);
    shopContextRef.current = null;
    setIsAuthenticated(false);
    await api.auth.logout(shouldRedirect ? window.location.href : undefined);
  }, []);

  const navigateToLogin = useCallback(() => {
    api.auth.redirectToLogin();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings: null,
      authChecked,
      shop: shopContext,
      isShopOwner: Boolean(shopContext?.isOwner),
      can,
      canEdit: canEditModule,
      refreshShop,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
