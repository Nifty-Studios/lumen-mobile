import { useEffect, useState } from "react";
import type { Friend } from "@lumen/shared";
import { lumen } from "../db/lumen";
import { useAccount } from "../data/hooks";

/** The account's friends and requests, kept current (undefined while loading or signed out). */
export function useFriends() {
  const { user } = useAccount();
  const [friends, setFriends] = useState<Friend[]>();
  useEffect(() => {
    if (!user) return setFriends(undefined);
    const load = () => lumen.account.friends().then(setFriends, () => setFriends((f) => f ?? []));
    load();
    return lumen.onFriendsChanged(load);
  }, [user]);
  return [friends, setFriends] as const;
}
