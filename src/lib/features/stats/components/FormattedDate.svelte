<script lang="ts">
  import type { Timestamp } from 'firebase/firestore'

  export let date: Timestamp | Date | undefined | null = undefined

  let formattedDate = 'Unknown date'

  $: if (date) {
    try {
      // Convert Firestore Timestamp to JS Date if necessary
      const jsDate = date instanceof Date ? date : date?.toDate()

      if (jsDate && !isNaN(jsDate.getTime())) {
        formattedDate = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(jsDate)
      } else {
        formattedDate = 'Invalid date'
      }
    } catch (e) {
      console.error('Error formatting date:', e)
      formattedDate = 'Error'
    }
  } else {
    formattedDate = 'Unknown date'
  }
</script>

<span>{formattedDate}</span>
