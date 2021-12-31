//import { Viewport } from 'pixi-viewport'

const canvas = document.getElementById('canvas')


const app = new PIXI.Application({
    view: canvas,
    width: window.innerWidth,
    height: window.innerHeight
});

const { stage, view, ticker, renderer } = app
document.body.appendChild(view)

const viewport = new pixi_viewport.Viewport({
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    worldWidth: 1000,
    worldHeight: 1000,

    interaction: app.renderer.plugins.interaction
})
app.stage.addChild(viewport)

viewport
    .drag()
    .wheel()

let peopleCount = 1000
let peopleRemaining = peopleCount
let peoples = []

const P_SIZE = 4
const H_SIZE = 80
const T_SIZE = 100

const D_RATE = 0.02
const C_RATE = 0.20

let world_size = 0

let dayStart
let currentTime
let day_count = 0
const day_length = 60000
let clock = new PIXI.Graphics()

let inf_count = 0

let CITY
let GRAPH

const new_day_event = new Event('NewDay')
window.addEventListener('NewDay', newday)


class Vector2 {
    x;
    y;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(vector) {
        return new Vector2(this.x + vector.x, this.y + vector.y);
    }
    subtract(vector) {
        return new Vector2(this.x - vector.x, this.y - vector.y);
    }
    multiply(vector) {
        return new Vector2(this.x * vector.x, this.y * vector.y);
    }
    divide(vector) {
        return new Vector2(this.x / vector.x, this.y / vector.y);
    }
    getMag() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }
    getX() {
        return this.x;
    }
    getY() {
        return this.y;
    }
    setX(x) {
        this.x = x;
    }
    setY(y) {
        this.y = y;
    }
    set(vec) {
        this.x = vec.x;
        this.y = vec.y;
    }
    get() {
        return this;
    }
}

class person {
    velocity = new Vector2(0, 0)
    position = new Vector2(0, 0)
    graphic
    home
    constructor(home, size, index) {
        this.home = home

        this.index = index
        this.dead = false
        if (!this.home) {
            this.home = CITY.homes[Math.floor(Math.random() * CITY.homes.length)]
        }
        this.position.x = this.home.w_x + T_SIZE / 2 + rand_int(-5, 5)
        this.position.y = this.home.w_y + T_SIZE / 2 + rand_int(-5, 5)
        this.currentTile = this.home

        this.size = size
        this.infected = false
        this.alone_time = 0
        this.render()
    }

    movement() {
        if (this.dead) return

        if (currentTime > day_length / 2) {
            if (this.currentTile == this.target && this.target.player_inside(this)) {
                if (this.alone_time <= 0) {
                    if (Math.random() > 0.9) {
                        this.target = this.home.city.homes[Math.floor(Math.random() * this.home.city.homes.length)]
                    } else {
                        this.alone_time = rand_int(1000, 4000)
                    }
                } else {
                    this.moveWithin(this.target)
                    this.alone_time--
                }
                return
            }
        } else {
            if (this.currentTile == this.target && this.target.player_inside(this)) {
                if (this.target != this.home) {
                    this.target = this.home
                }
                this.moveWithin(this.target)
                return
            }
        }
        if (this.currentTile.player_inside(this)) {
            let nextTile = this.currentTile.get_next_in_path(this.target, this.last_tile)
            this.last_tile = this.currentTile
            this.currentTile = nextTile
            this.moveTowards(this.currentTile)
        } else {
            this.moveTowards(this.currentTile)
        }
    }

    moveTowards(target) {
        let dir = Math.atan2(target.w_y + T_SIZE / 2 - this.position.y, target.w_x + T_SIZE / 2 - this.position.x)
        let new_vel = new Vector2(Math.cos(dir) * 1, Math.sin(dir) * 1)
        this.velocity.set(this.velocity.add(new_vel))
    }
    moveWithin(target) {
        if (!this.in_house(this.position, target)) {
            this.moveTowards(target)
            return
        }
        let new_vel = new Vector2(rand_int(-1, 1), rand_int(-1, 1))
        let new_pos = this.position.add(new_vel)
        if (!this.in_house(new_pos, target)) return
        this.velocity.set(this.velocity.add(new_vel))
    }
    adjust_course(other) {
        let new_vel = new Vector2(0, 0)
        if (Math.sign(this.velocity.x) + Math.sign(other.velocity.x) == 0) {
            new_vel.x = Math.sin(Math.sign(this.velocity.x) * (3 * Math.PI) / 2) * 0.5
        }
        if (Math.sign(this.velocity.y) + Math.sign(other.velocity.y) == 0) {
            new_vel.y = Math.sin(Math.sign(this.velocity.y) * (3 * Math.PI) / 2) * 0.5
        }
        this.velocity.set(this.velocity.add(new_vel))
    }

    in_house(position, house) {
        return (position.x >= house.w_x - 1 + T_SIZE - H_SIZE) && (position.x < house.w_x + H_SIZE) && (position.y >= house.w_y - 1 + T_SIZE - H_SIZE) && (position.y < house.w_y + H_SIZE)
    }

    begin_day(day) {
        this.day = day
        if (this.infected && !this.dead) {
            if (Math.random() > 1 - D_RATE) {
                this.kill()
            } else if (Math.random() > 1 - C_RATE) {
                this.cure()
            }
        }
        //this.target = CITY.homes[Math.floor(Math.random() * CITY.homes.length)]
        if (!this.home) {
            this.target = CITY.homes[Math.floor(Math.random() * CITY.homes.length)]
        }
        this.target = this.home
    }

    kill() {
        this.dead = true
        this.infected = false
        this.graphic.tint = 0xbdbdbd
        inf_count--
        peopleRemaining--
        for (let i = 0; i < peoples.length; i++) {
            if (peoples[i] == this) {
                peoples.splice(i, 1)
                break
            }

        }
    }
    cure() {
        if (!this.infected || this.dead) return
        this.infected = false
        this.graphic.tint = 0xffffff
        inf_count--
    }
    infect() {
        if (this.infected || this.dead) return
        this.infected = true
        this.graphic.tint = 0xbd0000
        inf_count++
    }
    render() {
        this.graphic = new PIXI.Graphics()
        this.graphic.beginFill(0xffffff)
        this.graphic.drawCircle(-this.size / 2, -this.size / 2, this.size)
        this.graphic.endFill()
        viewport.addChild(this.graphic)
        this.graphic.position.set(this.position.x, this.position.y)
    }
    draw() {
        this.position.set(this.position.add(this.velocity))
        this.graphic.position.set(this.position.x, this.position.y)
        this.velocity.set(new Vector2(0, 0))
    }

    setHome(house) {
        this.home = house
    }
    collides(point) {
        let dist = Math.sqrt(Math.pow((point.position.x - this.position.x), 2) + Math.pow((point.position.y - this.position.y), 2))
        return dist <= (point.size + this.size)
    }
}

///////////////////////////////////////////////////////////////
///////////// QUAD TREE COLLISION CODE/////////////////////////
///////////////////////////////////////////////////////////////

class rect {
    position
    dimensions
    constructor(x, y, w, h) {
        this.position = new Vector2(x, y)
        this.dimensions = new Vector2(w, h)
        //this.draw()
    }

    draw() {
        this.box = new PIXI.Graphics()
        this.box.lineStyle(3, 0xffffff)
        this.box.drawRect(0, 0, this.dimensions.x, this.dimensions.y)
        viewport.addChild(this.box)
        this.box.position.set(this.position.x, this.position.y)
    }

    within(point) {
        return ((point.position.x >= this.position.x) && (point.position.x <= this.position.x + this.dimensions.x) && (point.position.y >= this.position.y) && (point.position.y <= this.position.y + this.dimensions.y))
    }
    intersectsCircle(circle) {
        let distX = Math.abs(circle.position.x - (this.position.x + this.dimensions.x / 2))
        let distY = Math.abs(circle.position.y - (this.position.y + this.dimensions.y / 2))
        if (distX > (this.dimensions.x / 2 + circle.r)) return false
        if (distY > (this.dimensions.y / 2 + circle.r)) return false
        if (distX <= (this.dimensions.x / 2)) return true
        if (distY <= (this.dimensions.y / 2)) return true

        let dx = distX - this.dimensions.x / 2
        let dy = distY - this.dimensions.y / 2
        return (dx * dx + dy * dy <= (circle.r * circle.r))
    }
}

class radius {
    position
    constructor(x, y, r) {
        this.position = new Vector2(x, y)
        this.r = r
    }
    within(point) {
        let dist = Math.sqrt(Math.pow((point.position.x - this.position.x), 2) + Math.pow((point.position.y - this.position.y), 2))
        return dist <= (point.size + this.r)
    }
}

class QuadTree {
    constructor(rect, n) {
        this.bounds = rect
        this.size = n
        this.objects = []
    }

    split() {
        let rectTL = new rect(this.bounds.position.x, this.bounds.position.y, this.bounds.dimensions.x / 2, this.bounds.dimensions.y / 2)
        let rectTR = new rect(this.bounds.position.x + this.bounds.dimensions.x / 2, this.bounds.position.y, this.bounds.dimensions.x / 2, this.bounds.dimensions.y / 2)
        let rectBL = new rect(this.bounds.position.x, this.bounds.position.y + this.bounds.dimensions.y / 2, this.bounds.dimensions.x / 2, this.bounds.dimensions.y / 2)
        let rectBR = new rect(this.bounds.position.x + this.bounds.dimensions.x / 2, this.bounds.position.y + this.bounds.dimensions.y / 2, this.bounds.dimensions.x / 2, this.bounds.dimensions.y / 2)
        this.boxTL = new QuadTree(rectTL, this.size)
        this.boxTR = new QuadTree(rectTR, this.size)
        this.boxBL = new QuadTree(rectBL, this.size)
        this.boxBR = new QuadTree(rectBR, this.size)
        for (let o of this.objects) {
            this.boxTL.append(o)
            this.boxTR.append(o)
            this.boxBL.append(o)
            this.boxBR.append(o)
        }
        this.objects = []
    }

    append(object) {
        if (!this.bounds.within(object)) return

        if (this.objects.length < this.size && !this.isSplit) {
            this.objects.push(object)
        } else {
            if (!this.isSplit) {
                this.split()
                this.isSplit = true
            }
            this.boxTL.append(object)
            this.boxTR.append(object)
            this.boxBL.append(object)
            this.boxBR.append(object)
        }
    }
    query(range) {
        let result = []
        if (!this.bounds.intersectsCircle(range))
            return result


        if (!this.isSplit) {
            for (let o of this.objects) {
                if (range.within(o)) {
                    result.push(o)
                }
            }
            return result
        }

        result = result.concat(this.boxTL.query(range))
        result = result.concat(this.boxTR.query(range))
        result = result.concat(this.boxBL.query(range))
        result = result.concat(this.boxBR.query(range))

        return result
    }
}

///////////////////////////////////////////////////////////////
/////////////////////CITY BUILDING CODE////////////////////////
///////////////////////////////////////////////////////////////

class city {
    homes = []
    roads = []
    map = {}
    constructor(population) {
        this.population = population
        this.generate()
    }

    generate() {
        let home_count = Math.floor(this.population) + 1

        let scale = Math.round(1.3 * (Math.floor(Math.sqrt(home_count))))
        let x_max = /*Math.round((renderer.width / renderer.height)*/  scale
        let y_max = /*Math.round((renderer.height / renderer.width)*/  scale

        world_size = (x_max + 1) * T_SIZE
        for (let x = 0; x < x_max; x++) {
            for (let y = 0; y < y_max; y++) {
                this.map[x + ',' + y] = new tile(x, y, this)
            }
        }

        // for (let key in this.map) {
        //     if (this.map[key].x % 3 == 0 || this.map[key].y % 7 == 0) {
        //         let r = new road(this.map[key].x, this.map[key].y, this)
        //         this.map[key] = r
        //         this.roads.push(r)
        //     } else {
        //         let h = new house(this.map[key].x, this.map[key].y, this, key)
        //         this.map[key] = h
        //         this.homes.push(h)
        //     }
        // }

        let last = false
        let lastx = 0
        for (let x = 0; x < x_max; x++) {
            for (let y = 0; y < y_max; y++) {
                if (x % 3 == 0) {
                    lastx = Math.floor(x * (12 * psuedo_rand(lastx * y)))
                    last = true
                    let r = new road(x, y, this)
                    this.map[x + ',' + y] = r
                    this.roads.push(r)
                } else if (psuedo_rand(y + lastx) > 0.85 && !last && y > 5) {
                    last = true
                    let r = new road(x, y, this)
                    this.map[x + ',' + y] = r
                    this.roads.push(r)
                } else {
                    last = false
                    let h = new house(x, y, this, x + y)
                    this.map[x + ',' + y] = h
                    this.homes.push(h)
                }
            }
        }

        for (let key in this.map) {
            this.map[key].set_neighbors()
        }
    }

    populate() {
        for (let home of this.homes) {
            if (home.occupancy < 1) {
                home.occupancy++
                return home
            }
        }
    }
    get_tile(x, y) {
        let t = this.map[x + ',' + y]
        if (t) return t
        return false
    }

    find(x, y) {
        if (x % 7 == 0 || y % 3 == 0 && x >= 0 && y >= 0) {
            for (let road of this.roads) {
                if (road.x == x && road.y == y) {
                    return road
                }
            }
        } else {
            for (let home of this.homes) {
                if (home.x == x && home.y == y) {
                    return home
                }
            }
        }
        return false
    }
}

class tile {
    north
    east
    south
    west
    constructor(x, y, city) {
        this.x = x
        this.y = y
        this.city = city
        this.w_x = this.x * T_SIZE
        this.w_y = this.y * T_SIZE
    }

    player_inside(point) {
        return ((point.position.x >= this.w_x) && (point.position.x <= this.w_x + T_SIZE) && (point.position.y >= this.w_y) && (point.position.y <= this.w_y + T_SIZE))
    }
    set_neighbors() {
        this.north = this.city.map[this.x + ',' + (this.y + 1)]
        this.east = this.city.map[(this.x + 1) + ',' + this.y]
        this.south = this.city.map[this.x + ',' + (this.y - 1)]
        this.west = this.city.map[(this.x - 1) + ',' + this.y]
    }
    get_next_in_path(dest, last) {
        let options = []
        if (this.north) if (!this.north.isHouse && this.north != last) {
            options.push(this.north)
        } else if (this.north == dest) {
            return this.north
        }
        if (this.east) if (!this.east.isHouse && this.east != last) {
            options.push(this.east)
        } else if (this.east == dest) {
            return this.east
        }
        if (this.south) if (!this.south.isHouse && this.south != last) {
            options.push(this.south)
        } else if (this.south == dest) {
            return this.south
        }
        if (this.west) if (!this.west.isHouse && this.west != last) {
            options.push(this.west)
        } else if (this.west == dest) {
            return this.west
        }
        let smallest = options[Math.floor(Math.random() * options.length)]
        let sd = 100000
        let d = Math.abs(dest.x - this.x) + Math.abs(dest.y - this.y)
        if (d < 2) {
            return dest
        }
        if (options.length == 0) {
            return last
        }
        for (let o of options) {
            let d = Math.abs(dest.x - o.x) + Math.abs(dest.y - o.y)
            if (d < sd) {
                sd = d
                smallest = o
            }
        }
        return smallest
    }
}

class road extends tile {
    constructor(x, y, city) {
        super(x, y, city)
        this.isHouse = false

        // for (let road of this.city.roads) {
        //     if (road == this) continue
        //     this.add_road(road)
        // }
        // for (let home of this.city.homes) {
        //     this.add_house(home)
        // }
        this.draw()
    }
    // refresh_roads() {
    //     for (let road of this.city.roads) {
    //         if (road == this) continue
    //         this.add_road(road)
    //     }
    // }
    // add_house(house) {
    //     if (house.x == this.x && house.y == this.y + 1) {
    //         this.north = house
    //     }
    //     else if (house.x == this.x + 1 && house.y == this.y) {
    //         this.east = house
    //     }
    //     else if (house.x == this.x && house.y == this.y - 1) {
    //         this.south = house
    //     }
    //     else if (house.x == this.x - 1 && house.y == this.y) {
    //         this.west = house
    //     }
    // }
    // add_road(road) {
    //     if (road.x == this.x && road.y == this.y + 1) {
    //         this.north = road
    //     }
    //     else if (road.x == this.x + 1 && road.y == this.y) {
    //         this.east = road
    //     }
    //     else if (road.x == this.x && road.y == this.y - 1) {
    //         this.south = road
    //     }
    //     else if (road.x == this.x - 1 && road.y == this.y) {
    //         this.west = road
    //     }
    // }
    // extend() {
    //     let pos = this.get_valid_tile()
    //     let r = new road(pos[0], pos[1], this.city)
    //     this.add_road(r)
    //     this.city.roads.push(r)
    //     return r
    // }
    // max_houses() {
    //     let count = 0
    //     if (this.north) {
    //         if (this.north.isHouse) count++
    //     }
    //     if (this.east) {
    //         if (this.east.isHouse) count++
    //     }
    //     if (this.south) {
    //         if (this.south.isHouse) count++
    //     }
    //     if (this.west) {
    //         if (this.west.isHouse) count++
    //     }
    //     if (count > 1) {
    //         return true
    //     } else {
    //         return false
    //     }
    // }
    // is_full() {
    //     if (this.north && this.east && this.south && this.west) {
    //         return true
    //     } else {
    //         return false
    //     }
    // }
    // get_valid_tile() {
    //     let valid = []
    //     if (!this.north) {
    //         if (!this.city.find(this.x, this.y + 1)) {
    //             valid.push([this.x, this.y + 1])
    //         }
    //     }
    //     if (!this.east) {
    //         if (!this.city.find(this.x + 1, this.y)) {
    //             valid.push([this.x + 1, this.y])
    //         }
    //     }
    //     if (!this.south) {
    //         if (!this.city.find(this.x, this.y - 1)) {
    //             valid.push([this.x, this.y - 1])
    //         }
    //     }
    //     if (!this.west) {
    //         if (!this.city.find(this.x - 1, this.y)) {
    //             valid.push([this.x - 1, this.y])
    //         }
    //     }
    //     return valid[Math.floor(Math.random() * valid.length)]
    // }
    /*get_next_in_path(dest, last) {
        let options = []
        if (this.north) if (!this.north.isHouse && this.north != last) {
            options.push(this.north)
        } else if (this.north == dest) {
            return this.north
        }
        if (this.east) if (!this.east.isHouse && this.east != last) {
            options.push(this.east)
        } else if (this.east == dest) {
            return this.east
        }
        if (this.south) if (!this.south.isHouse && this.south != last) {
            options.push(this.south)
        } else if (this.south == dest) {
            return this.south
        }
        if (this.west) if (!this.west.isHouse && this.west != last) {
            options.push(this.west)
        } else if (this.west == dest) {
            return this.west
        }
        let smallest = options[Math.floor(Math.random() * options.length)]
        let sd = 100000
        let d = Math.abs(dest.x - this.x) + Math.abs(dest.y - this.y)
        if (d < 2) {
            return dest
        }
        if (options.length == 0) {
            return last
        }
        for (let o of options) {
            let d = Math.abs(dest.x - o.x) + Math.abs(dest.y - o.y)
            if (d < sd) {
                sd = d
                smallest = o
            }
        }
        return smallest
    }*/
    draw() {
        this.debug = new PIXI.Graphics()
        this.debug.beginFill(0xffff11)
        this.debug.drawCircle(0, 0, 5)
        this.debug.endFill()
        viewport.addChild(this.debug)
        this.debug.position.set(this.w_x + T_SIZE / 2, this.w_y + T_SIZE / 2)
    }
}

class house extends tile {
    occupancy = 0
    constructor(x, y, city, index) {
        super(x, y, city)
        this.index = index
        this.isHouse = true

        this.bounds = new rect(this.w_x + (T_SIZE - H_SIZE) / 2, this.w_y + (T_SIZE - H_SIZE) / 2, H_SIZE, H_SIZE)
        this.bounds.draw()
    }
    /*get_next_in_path(dest, last) {
        let north = new Vector2(this.x, this.y + 1)
        let east = new Vector2(this.x + 1, this.y)
        let south = new Vector2(this.x, this.y - 1)
        let west = new Vector2(this.x - 1, this.y)

        let smallest
        let sd = 100000

        for (let r of this.city.roads) {
            if ((r.x == north.x && r.y == north.y) || (r.x == east.x && r.y == east.y) || (r.x == south.x && r.y == south.y) || (r.x == west.x && r.y == west.y)) {
                let d = Math.abs(dest.x - r.x) + Math.abs(dest.y - r.y)
                if (d < sd) {
                    sd = d
                    smallest = r
                }
            }
        }
        return smallest
    }*/
}

///////////////////////////////////////////////////////////////
/////////////////////END CITY BUILDING CODE////////////////////
///////////////////////////////////////////////////////////////

class graph {
    constructor(tl, tr, w, h) {
        this.x = tl
        this.y = tr
        this.w = w
        this.h = h

        this.day = 0
        this.inf_data = []
        this.ppl_data = []

        this.display()
    }

    display() {
        this.box = new PIXI.Graphics()
        this.box.lineStyle(3, 0xffffff)
        this.box.beginFill(0x898989, 0.5)
        this.box.drawRect(0, 0, this.w, this.h)
        this.box.endFill()
        stage.addChild(this.box)
        this.box.position.set(this.x, this.y)

        this.xaxis = new PIXI.Graphics()
        this.xaxis.lineStyle(3, 0xffffff)
        this.xaxis.moveTo(25, this.h - 25)
        this.xaxis.lineTo(this.w - 25, this.h - 25)
        this.box.addChild(this.xaxis)

        this.yaxis = new PIXI.Graphics()
        this.yaxis.lineStyle(3, 0xffffff)
        this.yaxis.moveTo(25, this.h - 25)
        this.yaxis.lineTo(25, 25)
        this.box.addChild(this.yaxis)

        this.max_percent = new PIXI.Text('100%', { fontFamily: 'Arial', fontSize: 8, fill: 0x000000, align: 'center' });
        this.max_percent.position.set(0, 25)
        this.box.addChild(this.max_percent)

        this.current_percent = new PIXI.Text('0%', { fontFamily: 'Arial', fontSize: 8, fill: 0x000000, align: 'center' });
        this.current_percent.position.set(this.w - 25, this.h - 25)
        this.box.addChild(this.current_percent)

        this.max_day = new PIXI.Text('Day 0', { fontFamily: 'Arial', fontSize: 8, fill: 0x000000, align: 'center' });
        this.max_day.position.set(this.w - 25, this.h - 30)
        this.box.addChild(this.max_day)

        this.graph_line = new PIXI.Graphics()
        this.box.addChild(this.graph_line)

        this.graph_line_two = new PIXI.Graphics()
        this.box.addChild(this.graph_line_two)

        //this.graph_dots = new PIXI.Graphics()
        //this.box.addChild(this.graph_dots)
    }

    update(d) {
        this.day++
        this.max_day.text = 'Day ' + this.day

        this.current_percent.text = (d * 100).toFixed(2) + '%'
        this.current_percent.position.y = (this.h - 35) - (d * (this.h - 50))

        this.inf_data.push(d)
        //this.graph_dots.clear()
        this.graph_line.clear()
        this.graph_line.lineStyle(2, 0xff0000)
        this.graph_line.moveTo(25, this.h - 25)
        for (let i = 0; i < this.inf_data.length; i++) {
            //this.graph_line.lineStyle(2, 0x000000)
            this.graph_line.lineTo(25 + (i + 1) * ((this.w - 50) / this.inf_data.length), (this.h - 25) - ((this.inf_data[i]) * (this.h - 50)))
            //console.log(Math.round((i + 1) * Math.round((this.w - 25) / this.data.length)))
            //this.graph_line.lineStyle(0, 0x000000)
            //this.graph_dots.beginFill(0x0000ff)
            //this.graph_dots.drawCircle(25 + Math.round((i + 1) * Math.round((this.w - 50) / this.data.length)), Math.round((this.h - 25) - ((this.data[i]) * (this.h - 50))), 3)
            //this.graph_dots.endFill()
        }

        this.ppl_data.push(peopleRemaining / peopleCount)
        this.graph_line_two.clear()
        this.graph_line_two.lineStyle(2, 0x0000ff)
        this.graph_line_two.moveTo(25, 25)
        for (let i = 0; i < this.ppl_data.length; i++) {
            this.graph_line_two.lineTo(25 + (i + 1) * ((this.w - 50) / this.ppl_data.length), (this.h - 25) - ((this.ppl_data[i]) * (this.h - 50)))
        }
    }
}


function rand_int(lower, upper) {
    return Math.round((Math.random() * (upper - lower)) + lower)
}
function psuedo_rand(x) {
    return (1 + (Math.sin(3 * Math.sin(-1.2 * x) * -1 * (Math.sin(x + 4)) - Math.sin(4.5 * x) + Math.sin(-1.3 * x)))) / 2
}

function newday() {
    GRAPH.update(inf_count / peopleCount)
    day_count++


    let percent = 100 * (inf_count / peopleCount)
    console.log("Day: " + day_count + "\n" + percent.toFixed(2) + "% Infected")
    for (let p of peoples) {
        p.begin_day(day_count)
    }
}

ticker.add(() => {
    let baseRect = new rect(-T_SIZE, -T_SIZE, world_size + T_SIZE, world_size + T_SIZE)
    let baseQuad = new QuadTree(baseRect, 4)
    for (let p of peoples) {

        p.draw()
        p.movement()
        baseQuad.append(p)

    }

    for (let p of peoples) {
        let range = new radius(p.position.x, p.position.y, T_SIZE / 2)
        let others = baseQuad.query(range)
        if (others.length <= 0) continue
        for (let o of others) {
            if (p != o && p.collides(o)) {
                if (p.infected) o.infect()
                if (o.infected) p.infect()
            }
            if (o.infected && !p.infected) {
                p.adjust_course(o)
            }
        }
    }
    let d = new Date()
    currentTime = d.getTime() - dayStart
    if (currentTime >= day_length) {
        dayStart = d.getTime()
        window.dispatchEvent(new_day_event)
    }
    clock.rotation = (currentTime / day_length) * (2 * Math.PI)

})

function init() {
    CITY = new city(peopleCount)
    GRAPH = new graph(10, renderer.height - 310, 300, 300)
    for (let i = 0; i < peopleCount; i++) {
        peoples[i] = new person(CITY.populate(), P_SIZE, i)
        if (i < 20) {
            peoples[i].infect()
        }
    }
    let d = new Date()
    dayStart = d.getTime()
    newday()

    clock.beginFill(0xffffff)
    clock.drawRect(0, 0, 30, 5)
    clock.position.set(renderer.width - 50, 50)
    stage.addChild(clock)

    let circle = new PIXI.Graphics()
    circle.beginFill(0x555555)
    circle.drawCircle(0, 3, 7)
    clock.addChild(circle)
}

init()
