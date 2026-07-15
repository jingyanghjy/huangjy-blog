+++
date = '2026-07-15T11:49:41+08:00'
draft = true
title = 'New Article'

+++

# 一、MFD全称

Multi-function Device：多功能设备

# 二、为何会出现 MFD 子系统

由于出现了一类具有多种功能的外围设备或 cpu 内部集成的硬件模块，描述一个复杂设备可以抽象出哪些功能，每一个功能最终会注册为一个设备

# 三、有哪些多功能设备

## PMIC：电源管理芯片

> axp717C有多种功能：
>
> - Power按键
> - 外部电源检测（插入/移除）
> - 过压/欠压保存
> - 过流保护
> - 过温保护
> - 电量计算
> - 芯片温度检测

# 四、注册流程

```c
mfd_add_devices(struct device *dev, 0, struct mfd_cell* cells, cell_num, NULL, 0, NULL);
```

**第一个参数struct device *dev就是我们的多功能设备**

**第二个参数是一个struct mfd_cell结构体数组**

```c
struct mfd_cell {
	const char		*name;	//设备名字，会在注册platform设备时使用该名字
	int			id;			//同名设备需要使用id进行区分

	/* refcounting for multiple drivers to use a single cell */
	atomic_t		*usage_count;
	int			(*enable)(struct platform_device *dev);
	int			(*disable)(struct platform_device *dev);

	int			(*suspend)(struct platform_device *dev);
	int			(*resume)(struct platform_device *dev);

	/* platform data passed to the sub devices drivers */
	void			*platform_data;		//设备私有数据
	size_t			pdata_size;			//platform_data的大小

	/* device properties passed to the sub devices drivers */
	struct property_entry *properties;	// 如果需要为新注册的设备添加一个properties的话，可以使用该域

	/*
	 * Device Tree compatible string
	 * See: Documentation/devicetree/usage-model.txt Chapter 2.2 for details
	 */
	const char		*of_compatible;		// compatible属性，会在添加cell设备时通过该域寻找设备树生成的设备节点

	/* Matches ACPI */
	const struct mfd_cell_acpi_match	*acpi_match;	// acpi不管

	/*
	 * These resources can be specified relative to the parent device.
	 * For accessing hardware you should use resources from the platform dev
	 */
	int			num_resources;				// 资源数
	const struct resource	*resources;		// 设备资源，如果想为platform_device设置resource的话可以使用该域。设备树中的resource一般都是寄存器地址信息。

	/* don't check for resource conflicts */
	bool			ignore_resource_conflicts;

	/*
	 * Disable runtime PM callbacks for this subdevice - see
	 * pm_runtime_no_callbacks().
	 */
	bool			pm_runtime_no_callbacks;

	/* A list of regulator supplies that should be mapped to the MFD
	 * device rather than the child device when requested
	 */
	const char * const	*parent_supplies;
	int			num_parent_supplies;
};
```

**比如我把一个复杂设备抽象出了三个功能，我就可以这样设置mfd_cell数组：**

```c
static struct resource pmic_pek_resources[] = {

	// 13,连到controller(中断控制器PMIC)上的硬件中断号。
	// 这两个是同一按键然后分配了不同的中断，按键按下和松开各分配了一个中断
	// struct resource时用来描述platform总线设备的设备资源的结构体.
	{ 
		.start = 13,					// PMIC第13号中断, 按键下降沿中断
		.end = 13,	
		.name = "PEK_DBF",
		.flags = IORESOURCE_IRQ,
		.desc = IORES_DESC_NONE,
	},
	{ 
		.start = 14,	// PMIC第14号中断, 按键上升沿中断
		.end = 14,	
		.name = "PEK_DBR",
		.flags = IORESOURCE_IRQ,
		.desc = IORES_DESC_NONE,
	}

};

//内核有相关宏定义来定义中断资源
DEFINE_RES_IRQ_NAMED(statrt, name)
    
#define DEFINE_RES_IRQ_NAMED(_irq, _name)				\
	DEFINE_RES_NAMED((_irq), 1, (_name), IORESOURCE_IRQ)
    
#define DEFINE_RES_NAMED(_start, _size, _name, _flags)			\
	{								\
		.start = (_start),					\
		.end = (_start) + (_size) - 1,				\
		.name = (_name),					\
		.flags = (_flags),					\
		.desc = IORES_DESC_NONE,				\
	}
    
...
static struct mfd_cell mfd_i2cdev_cells[] = {
	{
		.name = "axpxxx-pek",	// 最终该name会被设置为为该cell注册的platform_device的name
		.num_resources = ARRAY_SIZE(pmic_pek_resources),	// 资源数
		.resources = pmic_pek_resources,					// 设备资源
		.of_compatible = "x-powers,axp305-pek",				// 在注册设备时会通过cell的该域和设备树节点的compatible匹配，来寻找设备树生成的设备树节点of_node，然后添加到注册的platform_device->dev.of_node
	},
	{
		// 这个cell啥都没有,但是仍然有.name。
		// 因为platform bus的匹配方式有一种匹配方式就是直接匹配platform_device->name和driver->name
		// 所以这也要求，driver注册的时候一定要初始化.name域，而且一定是"axp2101-regulator"，否则就没别的匹配方法给这个cell用了
		// 而这个cell没有of_compatible,说明这个cell可能没有对应的设备树节点,可能不是一个物理设备.
		.name = "axp305-regulator",
	},
	{
		.of_compatible = "xpower-vregulator,dcdc1",
		.name = "reg-virt-consumer",
		.id = 1, // 这个id会在platform_device_alloc(name, id)的时候传入，作为platform_dev->id，区分同名设备
		.platform_data = 根据driver的需求,自己定义,// 会被添加到注册的platform_dev->dev.platform_data,该platform_dev对应的driver需要用到时可以取出来
		.pdata_size = sizeof(AXP305_DCDC1_NAME),
	},
	{
		.of_compatible = "xpower-vregulator,dcdc2",
		.name = "reg-virt-consumer",
		.id = 2,
		.platform_data = ....,
		.pdata_size = sizeof(AXP305_DCDC2_NAME),
	},
	...
	...
};
```

# 五、举例分析





# 六、各个功能实现

## 1、电池拔插

## 2、充电开始与结束

## 3、电池电量检测

## 4、电池曲线



### 正确流程与关系

1. **中断发生，触发通知**：
   - 硬件中断发生，您的 `axp2202_irq_handler_bat_stat_change` 函数被调用。
   - 该函数执行 `power_supply_changed(bat_power->bat_supply);`。
   - **这行代码的作用是：** 在内核中设置一个标志，表示这个 `power_supply` 设备的状态已经发生变化。
2. **事件处理与用户空间通知**：
   - 内核在后台处理这个“改变事件”。它会做两件主要的事：
     - a) **遍历驱动支持的所有属性**：内核会（通过您定义的 `axp2202_bat_props` 数组）知道这个电池设备支持哪些属性（如 `STATUS`, `CAPACITY`, `VOLTAGE_NOW` 等）。为了确保内核内部的状态是最新的，它可能会（但不是一定会）主动读取所有这些属性。
     - b) **向用户空间发送事件**：内核会发送一个 **UEVENT** 到用户空间。这个事件就像一个大喇叭广播，内容是：“`/sys/class/power_supply/axp2202-battery/` 目录下的内容有变化！”。
3. **属性被查询，驱动回调**：
   - 用户空间的应用程序（比如负责显示电池图标的系统服务、`upower` 服务等）一直在监听这个UEVENT。
   - 当它们收到“电池状态改变”的通知后，这些应用程序会**主动地、按需地**去读取 `/sys/class/power_supply/axp2202-battery/` 目录下它们所关心的**特定**文件。
   - **每一次读取操作**，都会引发一次内核到驱动的回调：
     - 用户程序读 `/sys/class/power_supply/axp2202-battery/capacity` -> 内核调用 `axp2202_bat_get_property(psy, POWER_SUPPLY_PROP_CAPACITY, val)`。
     - 用户程序读 `/sys/class/power_supply/axp2202-battery/status` -> 内核调用 `axp2202_bat_get_property(psy, POWER_SUPPLY_PROP_STATUS, val)`。
     - 用户程序读 `/sys/class/power_supply/axp2202-battery/voltage_now` -> 内核调用 `axp2202_bat_get_property(psy, POWER_SUPPLY_PROP_VOLTAGE_NOW, val)`。

**举个例子：**
一次“充电完成”中断 (`AXP2202_IRQ_CHGDN`) 后：

1. 中断函数调用 `power_supply_changed()`。
2. 系统UI的电池服务收到通知。
3. 该服务想知道：“现在电量是多少？” -> 它去读 `capacity` 文件 -> 驱动执行 `axp2202_bat_get_property` 中的 `POWER_SUPPLY_PROP_CAPACITY` case。
4. 该服务还想知道：“充电状态变了吗？” -> 它去读 `status` 文件 -> 驱动执行 `axp2202_bat_get_property` 中的 `POWER_SUPPLY_PROP_STATUS` case。
5. `POWER_SUPPLY_PROP_VOLTAGE_MAX_DESIGN`（设计最大电压）是一个几乎不变的属性，所以UI服务通常不会在每次中断后都去读它。

### 电池曲线

寄存器是**电池电量计（Fuel Gauge）** 模块的核心寄存器之一，它主要负责存储电池的一些参数。电量计需要一套复杂的参数和算法来计算精确的剩余电量（SOC），这些参数就存储在芯片内部的存储器中。
