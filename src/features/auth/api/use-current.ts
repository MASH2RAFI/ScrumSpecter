import { useQuery } from "@tanstack/react-query";

import { client } from "@/lib/rpc"; 

export const useCurrent = () => { 
    const query = useQuery({
        queryKey: ["current"],
        queryFn: async () => { 
            const response = await client.api.auth.current.$get();

            if (!response.ok) { 
                return null;
            }
            const { user } = await response.json(); 
            
            return user;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
            // Don't retry on 4xx errors
            if (error instanceof Error && error.message.includes('4')) {
                return false;
            }
            return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        refetchOnMount: true,
    });
    return query;
};
    
