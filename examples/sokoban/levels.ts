/**
 * Sokoban level definitions in standard format.
 * # = wall, . = target, $ = crate, @ = player
 * + = player on target, * = crate on target
 */

// Level 1: Tutorial — 1 crate, 1 target
const LEVEL_1 = `
#####
#   #
# $ #
# . #
# @ #
#####
`.trim();

// Level 2: Two crates, simple push
const LEVEL_2 = `
######
#    #
# $$ #
# .. #
# @  #
######
`.trim();

// Level 3: L-shaped room
const LEVEL_3 = `
  ####
###  #
# $  #
# .# #
# .$ #
# @  #
######
`.trim();

// Level 4: Three crates, requires planning
const LEVEL_4 = `
 #####
##   ##
# $.$ #
# .#. #
# $.$ #
##   ##
 # @ #
 #####
`.trim();

// Level 5: Larger puzzle
const LEVEL_5 = `
  #####
  #   #
###$# #
# $ . #
# # .##
# @ ###
#####
`.trim();

export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5];
