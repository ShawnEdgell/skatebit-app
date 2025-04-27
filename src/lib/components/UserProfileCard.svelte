<script lang="ts">
  // Import the UserProfile type from your Firebase service file
  import type { UserProfile } from '$lib/firebase/users';
  // Import Lucide icons
  import { User, Youtube, Instagram, Twitter, Twitch, Link } from 'lucide-svelte';

  // --- Props ---
  // Accepts a UserProfile object or null if no profile exists/is loaded
  export let profile: UserProfile | null;

  // --- Helper Functions ---

  /**
   * Ensures a URL has a protocol (http:// or https://).
   * If not, prepends "https://". Returns undefined for empty/invalid input.
   * @param url The URL string to check.
   * @returns The URL with a protocol, or undefined.
   */
  function ensureProtocol(url?: string): string | undefined {
      if (!url || url.trim() === '') return undefined;
      // Allow mailto: links explicitly
      if (url.trim().toLowerCase().startsWith('mailto:')) return url;
      // Basic check if it looks like a URL needing a protocol
      if (!/^(https?:\/\/|mailto:)/i.test(url)) {
          // Check if it looks like a simple username (e.g., user#1234) - don't add protocol
          if (url.includes('#') && url.length > 2) {
              return undefined; // Don't treat Discord username as a URL to prepend protocol
          }
          // Otherwise, assume it's a web URL missing the protocol
          return 'https://' + url;
      }
      return url; // Already has a protocol
  }

  /**
   * Creates a display label for a Discord entry.
   * @param discordEntry The value from the profile's discord field.
   * @returns A display string (e.g., "username#1234" or "Server Invite").
   */
   function formatDiscord(discordEntry?: string): string | undefined {
       if (!discordEntry || discordEntry.trim() === '') return undefined;
       if (discordEntry.includes('discord.gg/') || discordEntry.includes('discord.com/invite/')) {
           return 'Server Invite'; // It's an invite link
       }
       // Otherwise, assume it's a username
       return discordEntry.trim();
   }

   /**
    * Creates a mailto: link for an email address.
    * @param email The email address.
    * @returns A mailto: string or undefined.
    */
   function formatEmailLink(email?: string | null): string | undefined {
       if (!email) return undefined;
       return `mailto:${email}`;
   }


  // --- Reactive Data Preparation ---

  // Prepare social links array for easy iteration in the template
  $: socialLinks = [
      // Discord: Special handling for username vs invite link
      { name: 'Discord', display: formatDiscord(profile?.discord), url: ensureProtocol(profile?.discord?.includes('discord.gg') || profile?.discord?.includes('discord.com/invite') ? profile?.discord : undefined), Icon: Link, color: 'badge-info' }, // Generic icon for now
      { name: 'TikTok', display: 'TikTok', url: ensureProtocol(profile?.tiktok), Icon: Link, color: 'badge-accent' }, // Generic icon
      { name: 'YouTube', display: 'YouTube', url: ensureProtocol(profile?.youtube), Icon: Youtube, color: 'badge-error' },
      { name: 'Instagram', display: 'Instagram', url: ensureProtocol(profile?.instagram), Icon: Instagram, color: 'badge-secondary' },
      // Add other potential links here if they are in your UserProfile type
      // { name: 'Twitter', display: 'Twitter', url: ensureProtocol(profile?.twitter), Icon: Twitter, color: 'badge-info' },
      // { name: 'Twitch', display: 'Twitch', url: ensureProtocol(profile?.twitch), Icon: Twitch, color: 'badge-primary' },
  ].filter(link => link.display); // Only include links that have a display value

</script>

{#if profile}
  <div class="card card-compact w-full bg-base-200 shadow-md hover:shadow-lg transition-shadow duration-150 ease-in-out">
    <div class="card-body">

      <div class="flex items-center gap-4 mb-3">
         {#if profile.photoURL}
            <div class="avatar">
              <div class="w-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-1">
                <img src={profile.photoURL} alt="{profile.name || 'User'}'s Avatar" referrerpolicy="no-referrer" />
              </div>
            </div>
          {:else}
             <div class="avatar placeholder">
               <div class="bg-neutral-focus text-neutral-content rounded-full w-12 ring ring-primary ring-offset-base-100 ring-offset-1 flex items-center justify-center">
                 <User class="w-6 h-6" />
               </div>
             </div>
          {/if}
          <div class="overflow-hidden">
              <h2 class="card-title text-lg truncate" title={profile.name || 'Anonymous User'}>
                  {profile.name || 'Anonymous User'}
              </h2>
              {#if profile.email}
                  <a href={formatEmailLink(profile.email)} class="text-xs text-base-content/70 hover:text-primary truncate block" title="Send email">
                      {profile.email}
                  </a>
              {/if}
          </div>
      </div>

      {#if profile.bio}
          <p class="text-sm mb-3 prose prose-sm max-w-none prose-p:my-1"> {/* DaisyUI prose + margin adjustments */}
              {profile.bio}
          </p>
      {/if}

      {#if socialLinks.length > 0}
          <div class="card-actions justify-start flex-wrap gap-1 pt-2 border-t border-base-300/50">
              {#each socialLinks as link}
                  {#if link.url}
                       <a href={link.url} target="_blank" rel="noopener noreferrer" class="badge {link.color} badge-outline gap-1 hover:brightness-110 transition-all text-xs" title="Visit {link.name}">
                          <svelte:component this={link.Icon} class="w-3 h-3" />
                          {link.display}
                      </a>
                  {:else}
                      <span class="badge {link.color} badge-outline gap-1 text-xs" title={link.name}>
                          <svelte:component this={link.Icon} class="w-3 h-3" />
                          {link.display}
                      </span>
                  {/if}
              {/each}
          </div>
      {/if}

    </div>
  </div>
{:else}
    <div class="card card-compact w-full bg-base-200 shadow-md">
        <div class="card-body">
            <p class="text-sm text-base-content/60 italic">Profile information not available.</p>
        </div>
    </div>
{/if}
