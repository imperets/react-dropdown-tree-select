/*!
 * React Dropdown Tree Select
 * A lightweight, fast and highly customizable tree select component.
 * Hrusikesh Panda <hrusikesh.panda@dowjones.com>
 * Copyright (c) 2017 Dow Jones, Inc. <support@dowjones.com> (http://dowjones.com)
 * license MIT
 * see https://github.com/dowjones/react-dropdown-tree-select
 */
import cn from 'classnames/bind'
import PropTypes from 'prop-types'
import React, { Component } from 'react'

import { isOutsideClick, clientIdGenerator } from './utils'
import Input from './input'
import Trigger from './trigger'
import Tree from './tree'
import TreeManager from './tree-manager'
import keyboardNavigation from './tree-manager/keyboardNavigation'

import styles from './index.css'

const cx = cn.bind(styles)

class DropdownTreeSelect extends Component {
  static propTypes = {
    data: PropTypes.oneOfType([PropTypes.object, PropTypes.array]).isRequired,
    clearSearchOnChange: PropTypes.bool,
    keepTreeOnSearch: PropTypes.bool,
    keepChildrenOnSearch: PropTypes.bool,
    keepOpenOnSelect: PropTypes.bool,
    texts: PropTypes.shape({
      placeholder: PropTypes.string,
      noMatches: PropTypes.string,
      label: PropTypes.string,
      labelRemove: PropTypes.string,
    }),
    showDropdown: PropTypes.bool,
    showDropdownAlways: PropTypes.bool,
    className: PropTypes.string,
    onChange: PropTypes.func,
    onAction: PropTypes.func,
    onNodeToggle: PropTypes.func,
    onFocus: PropTypes.func,
    onBlur: PropTypes.func,
    mode: PropTypes.oneOf(['multiSelect', 'simpleSelect', 'radioSelect']),
    showPartiallySelected: PropTypes.bool,
    disabled: PropTypes.bool,
    readOnly: PropTypes.bool,
    hierarchical: PropTypes.bool,
    id: PropTypes.string,
  }

  static defaultProps = {
    onFocus: () => {},
    onBlur: () => {},
    onChange: () => {},
    texts: {},
  }

  constructor(props) {
    super(props)
    this.state = {
      showDropdown: this.props.showDropdown || this.props.showDropdownAlways || false,
      searchModeOn: false,
      currentFocus: undefined,
    }
    this.clientId = props.id || clientIdGenerator.get(this)
  }

  initNewProps = ({ data, mode, showPartiallySelected, hierarchical }) => {
    this.treeManager = new TreeManager({
      data,
      mode,
      showPartiallySelected,
      hierarchical,
      rootPrefixId: this.clientId,
    })
    // Restore focus-state
    const currentFocusNode = this.state.currentFocus && this.treeManager.getNodeById(this.state.currentFocus)
    if (currentFocusNode) {
      currentFocusNode._focused = true
    }
    this.setState(this.treeManager.getTreeAndTags())
  }

  resetSearchState = () => {
    // clear the search criteria and avoid react controlled/uncontrolled warning
    this.searchInput.value = ''
    return {
      tree: this.treeManager.restoreNodes(), // restore the tree to its pre-search state
      searchModeOn: false,
      allNodesHidden: false,
    }
  }

  componentWillMount() {
    const { data, hierarchical } = this.props
    this.initNewProps({ data, hierarchical, ...this.props })
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleOutsideClick, false)
  }

  componentWillReceiveProps(nextProps) {
    this.initNewProps(nextProps)
  }

  handleClick = (e, callback) => {
    this.setState(prevState => {
      // keep dropdown active when typing in search box
      const showDropdown = this.props.showDropdownAlways || this.keepDropdownActive || !prevState.showDropdown

      // register event listeners only if there is a state change
      if (showDropdown !== prevState.showDropdown) {
        if (showDropdown) {
          document.addEventListener('click', this.handleOutsideClick, false)
        } else {
          document.removeEventListener('click', this.handleOutsideClick, false)
        }
      }

      if (showDropdown) this.props.onFocus()
      else this.props.onBlur()

      return !showDropdown ? { showDropdown, ...this.resetSearchState() } : { showDropdown }
    }, callback)
  }

  handleOutsideClick = e => {
    if (this.props.showDropdownAlways || !isOutsideClick(e, this.node)) {
      return
    }

    this.handleClick()
  }

  onInputChange = value => {
    const { allNodesHidden, tree } = this.treeManager.filterTree(
      value,
      this.props.keepTreeOnSearch,
      this.props.keepChildrenOnSearch
    )
    const searchModeOn = value.length > 0

    this.setState({
      tree,
      searchModeOn,
      allNodesHidden,
    })
  }

  onTagRemove = (id, isKeyboardEvent) => {
    const { tags: prevTags } = this.state
    this.onCheckboxChange(id, false, tags => {
      if (!isKeyboardEvent) return

      keyboardNavigation.getNextFocusAfterTagDelete(id, prevTags, tags, this.searchInput).focus()
    })
  }

  onNodeToggle = id => {
    this.treeManager.toggleNodeExpandState(id)
    const tree = this.state.searchModeOn ? this.treeManager.matchTree : this.treeManager.tree
    this.setState({ tree })
    typeof this.props.onNodeToggle === 'function' && this.props.onNodeToggle(this.treeManager.getNodeById(id))
  }

  onCheckboxChange = (id, checked, callback) => {
    const { mode, keepOpenOnSelect } = this.props
    this.treeManager.setNodeCheckedState(id, checked)
    let tags = this.treeManager.tags
    const isSingleSelect = ['simpleSelect', 'radioSelect'].indexOf(mode) > -1
    const showDropdown = isSingleSelect && !keepOpenOnSelect ? false : this.state.showDropdown

    if (!tags.length) {
      this.treeManager.restoreDefaultValues()
      tags = this.treeManager.tags
    }

    const tree = this.state.searchModeOn ? this.treeManager.matchTree : this.treeManager.tree
    const nextState = {
      tree,
      tags,
      showDropdown,
    }

    if ((isSingleSelect && !showDropdown) || this.props.clearSearchOnChange) {
      Object.assign(nextState, this.resetSearchState())
    }

    if (isSingleSelect && !showDropdown) {
      document.removeEventListener('click', this.handleOutsideClick, false)
    }

    this.setState(nextState, () => {
      callback && callback(tags)
    })
    this.props.onChange(this.treeManager.getNodeById(id), tags)
  }

  onAction = (nodeId, action) => {
    this.props.onAction(this.treeManager.getNodeById(nodeId), action)
  }

  onInputFocus = () => {
    this.keepDropdownActive = true
  }

  onInputBlur = () => {
    this.keepDropdownActive = false
  }

  onTrigger = e => {
    this.handleClick(e, () => {
      // If the dropdown is shown after key press, focus the input
      if (this.state.showDropdown) {
        this.searchInput.focus()
      }
    })
  }

  onKeyboardKeyDown = e => {
    const { readOnly, mode } = this.props
    const { showDropdown, tags, searchModeOn, currentFocus } = this.state
    const tm = this.treeManager
    const tree = searchModeOn ? tm.matchTree : tm.tree

    if (!showDropdown && (keyboardNavigation.isValidKey(e.key, false) || /^\w$/i.test(e.key))) {
      // Triggers open of dropdown and retriggers event
      e.persist()
      this.handleClick(null, () => this.onKeyboardKeyDown(e))
      if (/\w/i.test(e.key)) return
    } else if (showDropdown && keyboardNavigation.isValidKey(e.key, true)) {
      const newFocus = tm.handleNavigationKey(
        currentFocus,
        tree,
        e.key,
        readOnly,
        !searchModeOn,
        this.onCheckboxChange,
        this.onNodeToggle
      )
      if (newFocus !== currentFocus) {
        this.setState({ currentFocus: newFocus })
      }
    } else if (showDropdown && ['Escape', 'Tab'].indexOf(e.key) > -1) {
      if (mode === 'simpleSelect' && tree.has(currentFocus)) {
        this.onCheckboxChange(currentFocus, true)
      } else {
        // Triggers close
        this.keepDropdownActive = false
        this.handleClick()
      }
      return
    } else if (e.key === 'Backspace' && tags.length && this.searchInput.value.length === 0) {
      const lastTag = tags.pop()
      this.onCheckboxChange(lastTag._id, false)
    } else {
      return
    }
    e.preventDefault()
  }

  render() {
    const { disabled, readOnly, mode, texts } = this.props
    const { showDropdown, currentFocus } = this.state

    const activeDescendant = currentFocus ? `${currentFocus}_li` : undefined

    const commonProps = { disabled, readOnly, activeDescendant, texts, mode }

    return (
      <div
        id={this.clientId}
        className={cx(this.props.className, 'react-dropdown-tree-select')}
        ref={node => {
          this.node = node
        }}
      >
        <div
          className={cx(
            'dropdown',
            { 'simple-select': mode === 'simpleSelect' },
            { 'radio-select': mode === 'radioSelect' }
          )}
        >
          <Trigger onTrigger={this.onTrigger} showDropdown={showDropdown} {...commonProps}>
            <Input
              inputRef={el => {
                this.searchInput = el
              }}
              tags={this.state.tags}
              onInputChange={this.onInputChange}
              onFocus={this.onInputFocus}
              onBlur={this.onInputBlur}
              onTagRemove={this.onTagRemove}
              onKeyDown={this.onKeyboardKeyDown}
              {...commonProps}
            />
          </Trigger>
          {showDropdown && (
            <div className="dropdown-content">
              {this.state.allNodesHidden ? (
                <span className="no-matches">{texts.noMatches || 'No matches found'}</span>
              ) : (
                <Tree
                  data={this.state.tree}
                  keepTreeOnSearch={this.props.keepTreeOnSearch}
                  keepChildrenOnSearch={this.props.keepChildrenOnSearch}
                  searchModeOn={this.state.searchModeOn}
                  onAction={this.onAction}
                  onCheckboxChange={this.onCheckboxChange}
                  onNodeToggle={this.onNodeToggle}
                  mode={mode}
                  showPartiallySelected={this.props.showPartiallySelected}
                  clientId={this.clientId}
                  {...commonProps}
                />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}

export default DropdownTreeSelect
