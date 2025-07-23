import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
export default function Home() {
  return (
    <div className="">
        <Input />
        <Button>
          Primary
        </Button>
        <Button variant="secondary">
          secondary
        </Button>
        <Button variant="destructive">
          destructive
        </Button>
        <Button variant="ghost">
          Ghost
        </Button>
        <Button variant="muted">
          muted
        </Button>
        <Button variant="outline">
          Primary
        </Button>
        <Button variant="teritary">
          teritary
        </Button>

    </div>
  )
}
