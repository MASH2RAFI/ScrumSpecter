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
    });
    return query;
};
    
